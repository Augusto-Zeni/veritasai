import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { MemoryCacheStore } from '../src/cache/memory-cache.ts'
import {
  CachedLlmClient,
  generateJson,
  stripCodeFences,
  type GenerateOptions,
  type LlmClient,
  type LlmRequest,
  type LlmResponse,
} from '../src/clients/llm.ts'
import { LlmOutputError } from '../src/errors.ts'
import { UsageTracker } from '../src/usage.ts'

/** LLM falso: devolve os textos na ordem e grava as requisições. */
class FakeLlm implements LlmClient {
  readonly model = 'fake-model'
  readonly requests: LlmRequest[] = []
  constructor(private readonly outputs: string[]) {}
  async generate(request: LlmRequest, _options?: GenerateOptions): Promise<LlmResponse> {
    this.requests.push(request)
    const text = this.outputs.shift()
    if (text === undefined) throw new Error('FakeLlm: sem saídas')
    return { text, model: this.model, usage: { input: 10, output: 5 }, cached: false }
  }
}

const Schema = z.object({
  label: z.enum(['SUPORTADA', 'CONTRADITA', 'INSUFICIENTE']),
  rationale: z.string(),
})
const request: LlmRequest = {
  promptId: 'verification',
  promptVersion: '1',
  prompt: 'Afirmação: ...',
}

describe('stripCodeFences', () => {
  it('remove cercas ```json', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}')
    expect(stripCodeFences('  {"a":1} ')).toBe('{"a":1}')
  })
})

describe('generateJson', () => {
  it('valida a saída e envia o JSON Schema derivado do Zod', async () => {
    const llm = new FakeLlm(['{"label":"SUPORTADA","rationale":"ok"}'])
    const { data } = await generateJson(llm, request, Schema)
    expect(data).toEqual({ label: 'SUPORTADA', rationale: 'ok' })
    expect(llm.requests[0]?.responseJsonSchema).toMatchObject({
      type: 'object',
      required: ['label', 'rationale'],
    })
  })

  it('lança LlmOutputError para JSON inválido, guardando o texto bruto', async () => {
    const llm = new FakeLlm(['isto não é json'])
    const err = await generateJson(llm, request, Schema).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LlmOutputError)
    expect((err as LlmOutputError).rawText).toBe('isto não é json')
  })

  it('lança LlmOutputError quando o JSON não segue o schema', async () => {
    const llm = new FakeLlm(['{"label":"TALVEZ","rationale":"?"}'])
    await expect(generateJson(llm, request, Schema)).rejects.toBeInstanceOf(LlmOutputError)
  })
})

describe('CachedLlmClient', () => {
  it('a segunda chamada idêntica vem do cache e conta como cache hit', async () => {
    const inner = new FakeLlm(['{"label":"CONTRADITA","rationale":"x"}'])
    const tracker = new UsageTracker()
    const llm = new CachedLlmClient(inner, new MemoryCacheStore(), tracker)
    const a = await generateJson(llm, request, Schema)
    const b = await generateJson(llm, request, Schema)
    expect(a.response.cached).toBe(false)
    expect(b.response.cached).toBe(true)
    expect(b.data).toEqual(a.data)
    expect(b.response.usage).toEqual({ input: 10, output: 5 })
    expect(inner.requests).toHaveLength(1)
    expect(tracker.snapshot().cacheHits).toEqual({ gemini: 1 })
  })

  it('versão do prompt diferente não reaproveita o cache', async () => {
    const inner = new FakeLlm([
      '{"label":"SUPORTADA","rationale":"a"}',
      '{"label":"SUPORTADA","rationale":"b"}',
    ])
    const llm = new CachedLlmClient(inner, new MemoryCacheStore())
    await generateJson(llm, request, Schema)
    await generateJson(llm, { ...request, promptVersion: '2' }, Schema)
    expect(inner.requests).toHaveLength(2)
  })

  it('não guarda resposta inválida no cache', async () => {
    const inner = new FakeLlm(['quebrado', '{"label":"SUPORTADA","rationale":"ok"}'])
    const llm = new CachedLlmClient(inner, new MemoryCacheStore())
    await expect(generateJson(llm, request, Schema)).rejects.toBeInstanceOf(LlmOutputError)
    const { data, response } = await generateJson(llm, request, Schema)
    expect(data.label).toBe('SUPORTADA')
    expect(response.cached).toBe(false)
  })
})
