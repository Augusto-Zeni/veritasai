import { Writable } from 'node:stream'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp, loggerOptions, type BuildAppOptions } from '../src/app.ts'
import { FakeVerifier, flush } from './fakes.ts'

const URL_A = 'https://exemplo.com.br/noticia-a'

interface SseMessage {
  id?: string
  event?: string
  data?: unknown
}

function parseSse(text: string): SseMessage[] {
  return text
    .split('\n\n')
    .filter((block) => block.trim() && !block.startsWith(':') && !block.startsWith('retry:'))
    .map((block) => {
      const msg: SseMessage = {}
      for (const line of block.split('\n')) {
        const [key, ...rest] = line.split(': ')
        const value = rest.join(': ')
        if (key === 'id') msg.id = value
        if (key === 'event') msg.event = value
        if (key === 'data') msg.data = JSON.parse(value)
      }
      return msg
    })
}

let app: FastifyInstance | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

function make(verifier: FakeVerifier | null, extra: Partial<BuildAppOptions> = {}) {
  app = buildApp({ verifier, logger: false, ...extra })
  return app
}

async function postVerify(a: FastifyInstance, payload: unknown) {
  return a.inject({ method: 'POST', url: '/verify', payload: payload as object })
}

describe('GET /health', () => {
  it('pronto quando há verificador', async () => {
    const res = await make(new FakeVerifier()).inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok', ready: true, jobs: { running: 0 } })
  })

  it('indica o motivo quando a config está incompleta', async () => {
    const res = await make(null, { unavailableReason: 'GEMINI_MODEL não definido no .env' }).inject(
      {
        method: 'GET',
        url: '/health',
      },
    )
    expect(res.json()).toMatchObject({ ready: false, reason: 'GEMINI_MODEL não definido no .env' })
  })
})

describe('POST /verify', () => {
  it('cria a verificação e devolve os links de acompanhamento', async () => {
    const v = new FakeVerifier()
    const a = make(v)
    const res = await postVerify(a, { url: URL_A })
    expect(res.statusCode).toBe(202)
    const body = res.json()
    expect(body).toMatchObject({ status: 'running', reused: false })
    expect(body.streamUrl).toBe(`/verify/${body.id}/stream`)
    expect(body.statusUrl).toBe(`/verify/${body.id}`)
    expect(v.calls[0]!.url).toBe(URL_A)
  })

  it('reaproveita a verificação em andamento da mesma notícia', async () => {
    const a = make(new FakeVerifier())
    const first = (await postVerify(a, { url: URL_A })).json()
    const second = (await postVerify(a, { url: `${URL_A}?utm_medium=social` })).json()
    expect(second).toMatchObject({ id: first.id, reused: true })
  })

  it.each([
    [{}, 'INVALID_REQUEST'],
    [{ url: 123 }, 'INVALID_REQUEST'],
    [{ url: URL_A, force: 'sim' }, 'INVALID_REQUEST'],
    [{ url: 'nao-e-url' }, 'INVALID_URL'],
    [{ url: 'http://localhost:3000/health' }, 'INVALID_URL'],
    [{ url: 'http://192.168.0.1/' }, 'INVALID_URL'],
  ])('recusa %j com 400', async (payload, code) => {
    const v = new FakeVerifier()
    const res = await postVerify(make(v), payload)
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe(code)
    expect(v.calls).toHaveLength(0)
  })

  it('503 quando o servidor não está configurado', async () => {
    const res = await postVerify(make(null), { url: URL_A })
    expect(res.statusCode).toBe(503)
    expect(res.json().error.code).toBe('CONFIG')
  })

  it('503 com Retry-After quando a fila está cheia', async () => {
    const a = make(new FakeVerifier(), { maxConcurrentJobs: 1, maxQueue: 1 })
    await postVerify(a, { url: 'https://exemplo.com.br/1' })
    await postVerify(a, { url: 'https://exemplo.com.br/2' })
    const res = await postVerify(a, { url: 'https://exemplo.com.br/3' })
    expect(res.statusCode).toBe(503)
    expect(res.headers['retry-after']).toBe('60')
    expect(res.json().error.code).toBe('QUEUE_FULL')
  })
})

describe('GET /verify/:id', () => {
  it('mostra o estado e, ao terminar, o resultado', async () => {
    const v = new FakeVerifier()
    const a = make(v)
    const { id } = (await postVerify(a, { url: URL_A })).json()

    const running = await a.inject({ method: 'GET', url: `/verify/${id}` })
    expect(running.json()).toMatchObject({ id, status: 'running', url: URL_A })
    expect(running.json().result).toBeUndefined()

    v.release(URL_A)
    await flush()
    const done = (await a.inject({ method: 'GET', url: `/verify/${id}` })).json()
    expect(done.status).toBe('done')
    expect(done.result.verdict).toBe('VERDADEIRO')
    expect(done.result.claims[0].evidences[0].url).toBe('https://gov.br/x')
  })

  it('404 para id desconhecido', async () => {
    const a = make(new FakeVerifier())
    for (const url of ['/verify/nao-existe', '/verify/nao-existe/stream']) {
      const res = await a.inject({ method: 'GET', url })
      expect(res.statusCode).toBe(404)
      expect(res.json().error.code).toBe('NOT_FOUND')
    }
  })
})

describe('GET /verify/:id/stream (SSE)', () => {
  it('repete o histórico e encerra quando a verificação já terminou', async () => {
    const a = make(new FakeVerifier({ auto: true }))
    const { id } = (await postVerify(a, { url: URL_A })).json()
    await flush()

    const res = await a.inject({ method: 'GET', url: `/verify/${id}/stream` })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.headers['cache-control']).toContain('no-cache')
    const msgs = parseSse(res.body)
    expect(msgs.map((m) => m.event)).toEqual([
      'queued',
      'started',
      'stage',
      'article',
      'stage',
      'claims',
      'claim-done',
      'result',
    ])
    expect(msgs.map((m) => Number(m.id))).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(msgs.at(-1)?.data).toMatchObject({ type: 'result', result: { verdict: 'VERDADEIRO' } })
  })

  it('com Last-Event-ID envia só o que faltou', async () => {
    const a = make(new FakeVerifier({ auto: true }))
    const { id } = (await postVerify(a, { url: URL_A })).json()
    await flush()
    const res = await a.inject({
      method: 'GET',
      url: `/verify/${id}/stream`,
      headers: { 'last-event-id': '6' },
    })
    expect(parseSse(res.body).map((m) => m.event)).toEqual(['claim-done', 'result'])
  })

  it('transmite o progresso em tempo real até o resultado', async () => {
    const v = new FakeVerifier()
    const a = make(v, { heartbeatMs: 10 })
    await a.listen({ port: 0, host: '127.0.0.1' })
    const base = `http://127.0.0.1:${(a.server.address() as AddressInfo).port}`

    const { id } = (await postVerify(a, { url: URL_A })).json()
    const res = await fetch(`${base}/verify/${id}/stream`)
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()

    let text = ''
    const readUntil = async (needle: string) => {
      while (!text.includes(needle)) {
        const { value, done } = await reader.read()
        if (done) throw new Error(`stream terminou antes de "${needle}"`)
        text += value
      }
    }
    await readUntil('event: stage')
    expect(text).not.toContain('event: result')
    await readUntil(': ping') // keep-alive enquanto espera

    v.release(URL_A)
    await readUntil('event: result')
    const { done } = await reader.read()
    expect(done).toBe(true) // o servidor fecha o stream ao terminar
    expect(parseSse(text).at(-1)?.event).toBe('result')
  })

  it('transmite o erro público quando a verificação falha', async () => {
    const v = new FakeVerifier()
    const a = make(v)
    const { id } = (await postVerify(a, { url: URL_A })).json()
    v.fail(URL_A, new Error('detalhe interno'))
    await flush()
    const res = await a.inject({ method: 'GET', url: `/verify/${id}/stream` })
    const last = parseSse(res.body).at(-1)
    expect(last?.event).toBe('error')
    expect(JSON.stringify(last?.data)).not.toContain('detalhe interno')
  })
})

describe('logs', () => {
  it('não registram IP nem porta do cliente', async () => {
    const lines: string[] = []
    const stream = new Writable({
      write(chunk, _enc, cb) {
        lines.push(String(chunk))
        cb()
      },
    })
    const a = make(new FakeVerifier(), { logger: loggerOptions(stream) })
    await a.inject({ method: 'GET', url: '/health', remoteAddress: '203.0.113.7' })
    const log = lines.join('')
    expect(log).toContain('/health')
    expect(log).not.toContain('203.0.113.7')
    expect(log).not.toContain('remoteAddress')
  })
})
