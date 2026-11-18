/**
 * API HTTP do VeritasAI.
 *
 *   GET  /health                estado do servidor
 *   POST /verify                { url, force? } → 202 { id, status, streamUrl }
 *   GET  /verify/:id            estado atual (e resultado, se terminou)
 *   GET  /verify/:id/stream     progresso em tempo real (Server-Sent Events)
 *
 * Sem cadastro, sem cookies e sem IP nos logs (CLAUDE.md, seção 2).
 */
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import { VERSION, type Verifier } from '@veritasai/core'
import { z } from 'zod'
import { JobManager, QueueFullError, type Job, type StoredEvent } from './jobs.ts'
import { checkNewsUrl } from './url-guard.ts'

export interface BuildAppOptions {
  /** Verificador a usar; `null` quando a config está incompleta (a API sobe, mas recusa /verify). */
  verifier: Verifier | null
  /** Motivo exibido quando `verifier` é null. */
  unavailableReason?: string
  maxConcurrentJobs?: number
  maxQueue?: number
  jobTtlMs?: number
  /** Intervalo do comentário de keep-alive no SSE. */
  heartbeatMs?: number
  logger?: LoggerOption
}

type LoggerOption = NonNullable<FastifyServerOptions['logger']>

const VerifyBodySchema = z.object({
  url: z.string().trim().min(1).max(2048),
  force: z.boolean().optional(),
})

const TERMINAL = new Set(['result', 'error'])

/** Logs sem IP nem porta do cliente: só método e caminho. */
const REQUEST_SERIALIZER = {
  req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
}

/** Opções do logger (pino) usadas pela API; `stream` permite capturar os logs em teste. */
export function loggerOptions(stream?: NodeJS.WritableStream): LoggerOption {
  return {
    level: process.env.LOG_LEVEL ?? 'info',
    serializers: REQUEST_SERIALIZER,
    ...(stream ? { stream } : {}),
  }
}

function defaultLogger(): LoggerOption {
  return process.env.NODE_ENV === 'test' ? false : loggerOptions()
}

function sseFrame({ id, event }: StoredEvent): string {
  return `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

function jobSummary(job: Job) {
  return {
    id: job.id,
    url: job.url,
    status: job.status,
    createdAt: job.createdAt.toISOString(),
    ...(job.result ? { result: job.result } : {}),
    ...(job.error ? { error: job.error } : {}),
  }
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  const logger = options.logger ?? defaultLogger()
  const app = Fastify({ logger })
  const heartbeatMs = options.heartbeatMs ?? 15_000

  const manager = options.verifier
    ? new JobManager({
        verifier: options.verifier,
        maxConcurrent: options.maxConcurrentJobs ?? 1,
        maxQueue: options.maxQueue ?? 20,
        ttlMs: options.jobTtlMs ?? 15 * 60 * 1000,
        logger: app.log,
      })
    : null

  app.addHook('onClose', async () => manager?.close())

  app.get('/health', () => ({
    status: 'ok',
    version: VERSION,
    ready: manager !== null,
    ...(manager ? { jobs: manager.stats } : { reason: options.unavailableReason ?? '' }),
  }))

  app.post('/verify', async (request, reply) => {
    if (!manager) {
      return reply.code(503).send({
        error: {
          code: 'CONFIG',
          message:
            'O servidor não está configurado para verificar notícias (faltam chaves de API).',
        },
      })
    }
    const body = VerifyBodySchema.safeParse(request.body)
    if (!body.success) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Envie um JSON no formato { "url": "https://..." }',
        },
      })
    }
    const checked = checkNewsUrl(body.data.url)
    if (!checked.ok) {
      return reply.code(400).send({ error: { code: 'INVALID_URL', message: checked.reason } })
    }
    try {
      const { job, reused } = manager.create(checked.url.toString(), {
        force: body.data.force ?? false,
      })
      return reply.code(202).send({
        id: job.id,
        status: job.status,
        reused,
        statusUrl: `/verify/${job.id}`,
        streamUrl: `/verify/${job.id}/stream`,
      })
    } catch (err) {
      if (err instanceof QueueFullError) {
        return reply
          .code(503)
          .header('retry-after', '60')
          .send({
            error: {
              code: 'QUEUE_FULL',
              message: 'Muitas verificações em andamento. Tente novamente em alguns minutos.',
            },
          })
      }
      throw err
    }
  })

  const notFound = {
    error: { code: 'NOT_FOUND', message: 'Verificação não encontrada (o link pode ter expirado).' },
  }

  app.get<{ Params: { id: string } }>('/verify/:id', (request, reply) => {
    const job = manager?.get(request.params.id)
    if (!job) return reply.code(404).send(notFound)
    return jobSummary(job)
  })

  app.get<{ Params: { id: string }; Querystring: { lastEventId?: string } }>(
    '/verify/:id/stream',
    (request, reply) => {
      const job = manager?.get(request.params.id)
      if (!job) return reply.code(404).send(notFound)

      const lastIdRaw = request.headers['last-event-id'] ?? request.query.lastEventId
      const lastId = Number(Array.isArray(lastIdRaw) ? lastIdRaw[0] : lastIdRaw) || 0

      reply.hijack()
      const res = reply.raw
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      })
      res.write('retry: 3000\n\n')
      for (const e of job.eventsAfter(lastId)) res.write(sseFrame(e))
      if (job.finished) {
        res.end()
        return
      }

      const heartbeat = setInterval(() => res.write(': ping\n\n'), heartbeatMs)
      heartbeat.unref()
      const cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
      }
      const unsubscribe = job.subscribe((e) => {
        res.write(sseFrame(e))
        if (TERMINAL.has(e.event.type)) {
          cleanup()
          res.end()
        }
      })
      // Cliente desconectou: a verificação continua (o resultado fica disponível e em cache).
      res.on('close', cleanup)
    },
  )

  return app
}
