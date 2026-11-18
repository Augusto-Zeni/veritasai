/**
 * Verificações em andamento, só em memória (nenhum dado de usuário é persistido).
 *
 * Cada POST /verify cria um Job; o pipeline roda em segundo plano e os eventos de
 * progresso ficam guardados no Job para que o SSE possa repetir o histórico a quem
 * conectar depois (ou reconectar com Last-Event-ID). Jobs terminados expiram após `ttlMs`.
 */
import { randomUUID } from 'node:crypto'
import {
  domainOf,
  normalizeUrl,
  type PipelineEvent,
  type VerificationResult,
  type Verifier,
} from '@veritasai/core'
import { toPublicError, type PublicError } from './public-error.ts'

export type JobStatus = 'queued' | 'running' | 'done' | 'error'

export type JobEvent =
  | { type: 'queued'; position: number }
  | { type: 'started' }
  | PipelineEvent
  | { type: 'result'; result: VerificationResult }
  | { type: 'error'; error: PublicError }

export interface StoredEvent {
  id: number
  event: JobEvent
}

export interface JobLogger {
  info(obj: object, msg: string): void
  error(obj: object, msg: string): void
}

export class Job {
  status: JobStatus = 'queued'
  result: VerificationResult | undefined
  error: PublicError | undefined
  readonly events: StoredEvent[] = []
  private readonly listeners = new Set<(e: StoredEvent) => void>()

  constructor(
    readonly id: string,
    readonly url: string,
    readonly force: boolean,
    readonly createdAt: Date,
  ) {}

  get finished(): boolean {
    return this.status === 'done' || this.status === 'error'
  }

  push(event: JobEvent): void {
    const stored = { id: this.events.length + 1, event }
    this.events.push(stored)
    for (const fn of this.listeners) fn(stored)
  }

  /** Eventos com id maior que `afterId` (para reconexão com Last-Event-ID). */
  eventsAfter(afterId: number): StoredEvent[] {
    return this.events.filter((e) => e.id > afterId)
  }

  subscribe(fn: (e: StoredEvent) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

export class QueueFullError extends Error {
  constructor() {
    super('Fila de verificações cheia')
    this.name = 'QueueFullError'
  }
}

export interface JobManagerOptions {
  verifier: Verifier
  maxConcurrent: number
  maxQueue: number
  ttlMs: number
  logger?: JobLogger
  now?: () => Date
  newId?: () => string
}

export class JobManager {
  private readonly jobs = new Map<string, Job>()
  /** URL normalizada → job ainda não terminado (evita rodar a mesma notícia duas vezes). */
  private readonly active = new Map<string, Job>()
  private readonly waiting: Job[] = []
  private readonly timers = new Set<NodeJS.Timeout>()
  private running = 0
  private closed = false

  constructor(private readonly options: JobManagerOptions) {}

  /**
   * Cria (ou reaproveita) a verificação de uma URL. Lança QueueFullError se a fila
   * estiver cheia.
   */
  create(rawUrl: string, opts: { force?: boolean } = {}): { job: Job; reused: boolean } {
    if (this.closed) throw new QueueFullError()
    const url = normalizeUrl(rawUrl)
    const existing = this.active.get(url)
    if (existing) return { job: existing, reused: true }
    if (this.waiting.length >= this.options.maxQueue) throw new QueueFullError()

    const job = new Job(
      this.options.newId?.() ?? randomUUID(),
      url,
      opts.force ?? false,
      this.options.now?.() ?? new Date(),
    )
    this.jobs.set(job.id, job)
    this.active.set(url, job)
    this.waiting.push(job)
    job.push({ type: 'queued', position: this.waiting.length })
    this.pump()
    return { job, reused: false }
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id)
  }

  get stats(): { running: number; queued: number; stored: number } {
    return { running: this.running, queued: this.waiting.length, stored: this.jobs.size }
  }

  /** Para de aceitar verificações e descarta os timers de expiração. */
  close(): void {
    this.closed = true
    for (const t of this.timers) clearTimeout(t)
    this.timers.clear()
  }

  private pump(): void {
    let started = false
    while (this.running < this.options.maxConcurrent && this.waiting.length > 0) {
      const job = this.waiting.shift()!
      started = true
      this.running++
      void this.execute(job).finally(() => {
        this.running--
        this.pump()
      })
    }
    if (started) {
      this.waiting.forEach((job, i) => job.push({ type: 'queued', position: i + 1 }))
    }
  }

  private async execute(job: Job): Promise<void> {
    const { logger } = this.options
    const t0 = performance.now()
    job.status = 'running'
    job.push({ type: 'started' })
    try {
      const result = await this.options.verifier.run(job.url, {
        force: job.force,
        onEvent: (event) => job.push(event),
      })
      job.result = result
      job.status = 'done'
      job.push({ type: 'result', result })
      logger?.info(
        {
          jobId: job.id,
          domain: domainOf(job.url),
          verdict: result.verdict,
          claims: result.claims.length,
          cacheHit: result.meta.cacheHit,
          durationMs: Math.round(performance.now() - t0),
        },
        'verificação concluída',
      )
    } catch (err) {
      const error = toPublicError(err)
      job.error = error
      job.status = 'error'
      job.push({ type: 'error', error })
      logger?.error(
        {
          jobId: job.id,
          domain: domainOf(job.url),
          code: error.code,
          err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
          durationMs: Math.round(performance.now() - t0),
        },
        'verificação falhou',
      )
    } finally {
      this.active.delete(job.url)
      this.scheduleExpiry(job)
    }
  }

  private scheduleExpiry(job: Job): void {
    if (this.closed) return
    const timer = setTimeout(() => {
      this.jobs.delete(job.id)
      this.timers.delete(timer)
    }, this.options.ttlMs)
    timer.unref()
    this.timers.add(timer)
  }
}
