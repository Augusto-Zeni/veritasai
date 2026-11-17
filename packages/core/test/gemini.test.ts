import { ApiError, GenerateContentResponse, type GenerateContentParameters } from '@google/genai'
import { describe, expect, it } from 'vitest'
import { GeminiClient, toLlmError, type GeminiModelsApi } from '../src/clients/gemini.ts'
import { ConfigError, LlmError, LlmOutputError, LlmQuotaError } from '../src/errors.ts'
import { RateLimiter } from '../src/utils/rate-limiter.ts'
import { UsageTracker } from '../src/usage.ts'
import { fastRetry } from './helpers.ts'

function response(text: string | undefined, usage = { prompt: 100, candidates: 20, thoughts: 30 }) {
  return Object.assign(new GenerateContentResponse(), {
    candidates: [
      {
        content: { role: 'model', parts: text === undefined ? [] : [{ text }] },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: {
      promptTokenCount: usage.prompt,
      candidatesTokenCount: usage.candidates,
      thoughtsTokenCount: usage.thoughts,
    },
  })
}

class FakeModels implements GeminiModelsApi {
  readonly calls: GenerateContentParameters[] = []
  constructor(private readonly outputs: Array<GenerateContentResponse | Error>) {}
  async generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    this.calls.push(params)
    const next = this.outputs.shift()
    if (!next) throw new Error('FakeModels: sem saídas')
    if (next instanceof Error) throw next
    return next
  }
}

const limiter = () => new RateLimiter({ rpm: 1000, rpd: 1000 })
const request = {
  promptId: 'p',
  promptVersion: '1',
  prompt: 'Olá',
  system: 'Você é um verificador.',
}

describe('GeminiClient', () => {
  it('envia temperature 0, seed, system e JSON schema; soma tokens de raciocínio', async () => {
    const models = new FakeModels([response('{"ok":true}')])
    const tracker = new UsageTracker()
    const client = new GeminiClient({ model: 'gemini-teste', models, limiter: limiter(), tracker })
    const res = await client.generate({ ...request, responseJsonSchema: { type: 'object' } })

    expect(res).toEqual({
      text: '{"ok":true}',
      model: 'gemini-teste',
      usage: { input: 100, output: 50 },
      cached: false,
    })
    expect(models.calls[0]).toMatchObject({
      model: 'gemini-teste',
      contents: 'Olá',
      config: {
        temperature: 0,
        seed: 42,
        systemInstruction: 'Você é um verificador.',
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
      },
    })
    expect(tracker.snapshot()).toMatchObject({
      tokens: { input: 100, output: 50 },
      apiCalls: { gemini: 1 },
    })
  })

  it('tenta de novo após 429 temporário e respeita o retryDelay', async () => {
    const err429 = new ApiError({
      status: 429,
      message:
        '{"error":{"code":429,"details":[{"retryDelay":"7s"}],"status":"RESOURCE_EXHAUSTED"}}',
    })
    const models = new FakeModels([err429, response('ok')])
    const delays: number[] = []
    const client = new GeminiClient({
      model: 'm',
      models,
      limiter: limiter(),
      retry: { ...fastRetry, sleep: async (ms) => void delays.push(ms) },
    })
    expect((await client.generate(request)).text).toBe('ok')
    expect(delays).toEqual([7000])
  })

  it('não tenta de novo quando a cota diária acabou', async () => {
    const err = new ApiError({
      status: 429,
      message: 'Quota exceeded: GenerateRequestsPerDayPerProjectPerModel',
    })
    const models = new FakeModels([err, response('nunca')])
    const client = new GeminiClient({ model: 'm', models, limiter: limiter(), retry: fastRetry })
    await expect(client.generate(request)).rejects.toBeInstanceOf(LlmQuotaError)
    expect(models.calls).toHaveLength(1)
  })

  it('resposta vazia vira LlmOutputError', async () => {
    const client = new GeminiClient({
      model: 'm',
      models: new FakeModels([response(undefined)]),
      limiter: limiter(),
    })
    await expect(client.generate(request)).rejects.toBeInstanceOf(LlmOutputError)
  })

  it('exige modelo e chave', () => {
    expect(() => new GeminiClient({ model: '', apiKey: 'x', limiter: limiter() })).toThrow(
      ConfigError,
    )
    expect(() => new GeminiClient({ model: 'm', limiter: limiter() })).toThrow(ConfigError)
  })
})

describe('toLlmError', () => {
  it('classifica erros do SDK', () => {
    expect(toLlmError(new ApiError({ status: 503, message: 'overloaded' }))).toMatchObject({
      retryable: true,
      status: 503,
    })
    expect(toLlmError(new ApiError({ status: 400, message: 'bad' }))).toMatchObject({
      retryable: false,
    })
    const net = toLlmError(new TypeError('fetch failed'))
    expect(net).toBeInstanceOf(LlmError)
    expect(net.retryable).toBe(true)
  })
})
