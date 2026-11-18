import { LlmQuotaError, ScrapeError } from '@veritasai/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JobManager, QueueFullError } from '../src/jobs.ts'
import { FakeVerifier, flush } from './fakes.ts'

const A = 'https://exemplo.com.br/a'
const B = 'https://exemplo.com.br/b'
const C = 'https://exemplo.com.br/c'

let seq = 0
function manager(
  verifier: FakeVerifier,
  opts: { maxConcurrent?: number; maxQueue?: number; ttlMs?: number } = {},
) {
  return new JobManager({
    verifier,
    maxConcurrent: opts.maxConcurrent ?? 1,
    maxQueue: opts.maxQueue ?? 10,
    ttlMs: opts.ttlMs ?? 60_000,
    newId: () => `job-${++seq}`,
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('JobManager', () => {
  it('executa a verificação e guarda os eventos em ordem', async () => {
    const v = new FakeVerifier({ auto: true })
    const m = manager(v)
    const { job, reused } = m.create(A)
    expect(reused).toBe(false)
    await flush()

    expect(job.status).toBe('done')
    expect(job.result?.verdict).toBe('VERDADEIRO')
    const types = job.events.map((e) => e.event.type)
    expect(types[0]).toBe('queued')
    expect(types[1]).toBe('started')
    expect(types.at(-1)).toBe('result')
    expect(job.events.map((e) => e.id)).toEqual(types.map((_, i) => i + 1))
    expect(job.eventsAfter(types.length - 1).map((e) => e.event.type)).toEqual(['result'])
    m.close()
  })

  it('reaproveita a verificação em andamento da mesma URL (normalizada)', async () => {
    const v = new FakeVerifier()
    const m = manager(v)
    const first = m.create(A)
    const second = m.create(`${A}?utm_source=whatsapp#topo`)
    expect(second.reused).toBe(true)
    expect(second.job).toBe(first.job)
    expect(v.calls).toHaveLength(1)

    v.release(A)
    await flush()
    const third = m.create(A)
    expect(third.reused).toBe(false)
    expect(third.job.id).not.toBe(first.job.id)
    m.close()
  })

  it('repassa force ao verificador', () => {
    const v = new FakeVerifier()
    const m = manager(v)
    m.create(A, { force: true })
    expect(v.calls[0]!.options.force).toBe(true)
    m.close()
  })

  it('respeita o limite de concorrência e informa a posição na fila', async () => {
    const v = new FakeVerifier()
    const m = manager(v, { maxConcurrent: 1 })
    const a = m.create(A).job
    const b = m.create(B).job
    const c = m.create(C).job
    expect(a.status).toBe('running')
    expect(b.status).toBe('queued')
    expect(c.events.at(-1)?.event).toEqual({ type: 'queued', position: 2 })
    expect(m.stats).toMatchObject({ running: 1, queued: 2 })

    v.release(A)
    await flush()
    expect(b.status).toBe('running')
    expect(c.events.at(-1)?.event).toEqual({ type: 'queued', position: 1 })
    expect(v.isRunning(C)).toBe(false)
    m.close()
  })

  it('recusa quando a fila está cheia', () => {
    const v = new FakeVerifier()
    const m = manager(v, { maxConcurrent: 1, maxQueue: 1 })
    m.create(A) // executando
    m.create(B) // na fila
    expect(() => m.create(C)).toThrow(QueueFullError)
    m.close()
  })

  it('converte erros em mensagens públicas, sem vazar detalhes internos', async () => {
    const v = new FakeVerifier()
    const logs: object[] = []
    const m = new JobManager({
      verifier: v,
      maxConcurrent: 2,
      maxQueue: 10,
      ttlMs: 60_000,
      logger: { info: () => {}, error: (obj) => logs.push(obj) },
    })
    const quota = m.create(A).job
    const crash = m.create(B).job
    v.fail(A, new LlmQuotaError('429 RESOURCE_EXHAUSTED project 1234'))
    v.fail(B, new TypeError('segredo interno'))
    await flush()

    expect(quota.status).toBe('error')
    expect(quota.error?.code).toBe('LLM_QUOTA')
    expect(quota.error?.message).not.toContain('1234')
    expect(quota.events.at(-1)?.event.type).toBe('error')
    expect(crash.error).toEqual({
      code: 'INTERNAL',
      message: 'Erro interno ao verificar a notícia.',
    })
    // O detalhe vai para o log (com o domínio, não a URL completa).
    expect(JSON.stringify(logs)).toContain('1234')
    expect(logs[0]).toMatchObject({ domain: 'exemplo.com.br' })
    m.close()
  })

  it('mensagem específica para falha de extração', async () => {
    const m = manager(new FakeVerifier({ error: new ScrapeError('403') }))
    const { job } = m.create(A)
    await flush()
    expect(job.error?.code).toBe('SCRAPE')
    expect(job.error?.message).toContain('extrair o texto')
    m.close()
  })

  it('apaga verificações terminadas depois do TTL', async () => {
    vi.useFakeTimers()
    const m = manager(new FakeVerifier({ auto: true }), { ttlMs: 1000 })
    const { job } = m.create(A)
    await vi.advanceTimersByTimeAsync(0)
    expect(m.get(job.id)).toBe(job)
    await vi.advanceTimersByTimeAsync(1000)
    expect(m.get(job.id)).toBeUndefined()
    m.close()
  })

  it('não aceita novas verificações depois de fechado', () => {
    const m = manager(new FakeVerifier())
    m.close()
    expect(() => m.create(A)).toThrow(QueueFullError)
  })
})
