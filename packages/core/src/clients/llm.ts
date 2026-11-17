import { z } from 'zod'
import type { CacheStore } from '../cache/cache-store.ts'
import { TokenUsageSchema, type TokenUsage } from '../domain/schemas.ts'
import { LlmOutputError } from '../errors.ts'
import { stableHash } from '../utils/hash.ts'
import type { UsageTracker } from '../usage.ts'

export interface LlmRequest {
  /** Identificador do prompt (front-matter `id`), entra na chave de cache e no `meta`. */
  promptId: string
  /** Versão do prompt (front-matter `version`). */
  promptVersion: string
  system?: string
  prompt: string
  /** Padrão 0. */
  temperature?: number
  /** JSON Schema da saída esperada (modo JSON estruturado do provedor). */
  responseJsonSchema?: unknown
}

export interface LlmResponse {
  text: string
  model: string
  usage: TokenUsage
  cached: boolean
}

export interface GenerateOptions {
  /**
   * Validação da resposta. Se lançar erro, a resposta não é guardada no cache
   * (e uma entrada de cache inválida é ignorada).
   */
  validate?: (text: string) => void
}

export interface LlmClient {
  readonly model: string
  generate(request: LlmRequest, options?: GenerateOptions): Promise<LlmResponse>
}

const CachedLlmResponseSchema = z.object({ text: z.string(), usage: TokenUsageSchema })

/** Decorador que guarda respostas do LLM no cache (namespace = nome do modelo). */
export class CachedLlmClient implements LlmClient {
  constructor(
    private readonly inner: LlmClient,
    private readonly cache: CacheStore,
    private readonly tracker?: UsageTracker,
  ) {}

  get model(): string {
    return this.inner.model
  }

  async generate(request: LlmRequest, options: GenerateOptions = {}): Promise<LlmResponse> {
    const key = stableHash({ ...request, temperature: request.temperature ?? 0 })
    const hit = CachedLlmResponseSchema.safeParse(await this.cache.getResponse(this.model, key))
    if (hit.success && isValid(hit.data.text, options.validate)) {
      this.tracker?.recordCacheHit('gemini')
      return { ...hit.data, model: this.model, cached: true }
    }
    const response = await this.inner.generate(request, options)
    options.validate?.(response.text)
    await this.cache.setResponse(this.model, key, { text: response.text, usage: response.usage })
    return response
  }
}

function isValid(text: string, validate: GenerateOptions['validate']): boolean {
  if (!validate) return true
  try {
    validate(text)
    return true
  } catch {
    return false
  }
}

/** Remove cercas de código markdown (```json ... ```) que alguns modelos adicionam. */
export function stripCodeFences(text: string): string {
  const match = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(text)
  return match ? match[1]! : text.trim()
}

export function parseJsonOutput<T>(text: string, schema: z.ZodType<T>): T {
  let json: unknown
  try {
    json = JSON.parse(stripCodeFences(text))
  } catch (cause) {
    throw new LlmOutputError('A resposta do LLM não é JSON válido', text, { cause })
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new LlmOutputError(
      `A resposta do LLM não segue o schema esperado: ${z.prettifyError(parsed.error)}`,
      text,
      { cause: parsed.error },
    )
  }
  return parsed.data
}

/**
 * Gera uma resposta JSON e valida com Zod. O JSON Schema enviado ao provedor
 * é derivado do próprio schema Zod.
 */
export async function generateJson<T>(
  client: LlmClient,
  request: LlmRequest,
  schema: z.ZodType<T>,
): Promise<{ data: T; response: LlmResponse }> {
  const response = await client.generate(
    { ...request, responseJsonSchema: request.responseJsonSchema ?? z.toJSONSchema(schema) },
    { validate: (text) => void parseJsonOutput(text, schema) },
  )
  return { data: parseJsonOutput(response.text, schema), response }
}
