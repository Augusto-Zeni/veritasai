import {
  ApiError,
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai'
import {
  ConfigError,
  LlmError,
  LlmOutputError,
  LlmQuotaError,
  isRetryableStatus,
} from '../errors.ts'
import type { RateLimiter } from '../utils/rate-limiter.ts'
import { withRetry, type RetryOptions } from '../utils/retry.ts'
import type { UsageTracker } from '../usage.ts'
import type { GenerateOptions, LlmClient, LlmRequest, LlmResponse } from './llm.ts'

export interface GeminiModelsApi {
  generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>
}

export interface GeminiClientOptions {
  model: string
  limiter: RateLimiter
  apiKey?: string
  /** Injeção para testes; se ausente, usa o SDK `@google/genai` com `apiKey`. */
  models?: GeminiModelsApi
  tracker?: UsageTracker
  /** Semente fixa para aumentar a reprodutibilidade (o Gemini não garante determinismo). */
  seed?: number
  retry?: RetryOptions
}

export class GeminiClient implements LlmClient {
  readonly model: string
  private readonly models: GeminiModelsApi
  private readonly limiter: RateLimiter
  private readonly tracker: UsageTracker | undefined
  private readonly seed: number
  private readonly retry: RetryOptions

  constructor(options: GeminiClientOptions) {
    if (!options.model) throw new ConfigError('GEMINI_MODEL não definido no .env')
    if (!options.models && !options.apiKey)
      throw new ConfigError('GEMINI_API_KEY não definido no .env')
    this.model = options.model
    this.models = options.models ?? new GoogleGenAI({ apiKey: options.apiKey ?? '' }).models
    this.limiter = options.limiter
    this.tracker = options.tracker
    this.seed = options.seed ?? 42
    this.retry = options.retry ?? {}
  }

  async generate(request: LlmRequest, _options?: GenerateOptions): Promise<LlmResponse> {
    return withRetry(() => this.limiter.schedule(() => this.call(request)), this.retry)
  }

  private async call(request: LlmRequest): Promise<LlmResponse> {
    let res: GenerateContentResponse
    try {
      res = await this.models.generateContent({
        model: this.model,
        contents: request.prompt,
        config: {
          temperature: request.temperature ?? 0,
          seed: this.seed,
          ...(request.system !== undefined && { systemInstruction: request.system }),
          ...(request.responseJsonSchema !== undefined && {
            responseMimeType: 'application/json',
            responseJsonSchema: request.responseJsonSchema,
          }),
        },
      })
    } catch (err) {
      this.tracker?.recordCall('gemini')
      throw toLlmError(err)
    }

    const meta = res.usageMetadata
    const usage = {
      input: meta?.promptTokenCount ?? 0,
      // Tokens de "raciocínio" (thinking) também são cobrados como saída.
      output: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
    }
    this.tracker?.recordCall('gemini', usage)

    const text = res.text
    if (!text) {
      const reason = res.candidates?.[0]?.finishReason ?? 'desconhecido'
      throw new LlmOutputError(`O Gemini devolveu resposta vazia (finishReason: ${reason})`, '')
    }
    return { text, model: this.model, usage, cached: false }
  }
}

/** Converte erros do SDK em erros tipados. */
export function toLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err
  if (err instanceof ApiError) {
    if (err.status === 429) {
      // Cota diária esgotada: não adianta tentar de novo agora.
      const daily = /PerDay/i.test(err.message)
      return new LlmQuotaError(`Cota do Gemini esgotada (429): ${err.message}`, {
        cause: err,
        status: 429,
        retryable: !daily,
        ...retryDelay(err.message),
      })
    }
    return new LlmError(`Erro da API do Gemini (${err.status}): ${err.message}`, {
      cause: err,
      status: err.status,
      retryable: isRetryableStatus(err.status),
    })
  }
  // Falha de rede, timeout etc.
  const message = err instanceof Error ? err.message : String(err)
  return new LlmError(`Falha ao chamar o Gemini: ${message}`, { cause: err, retryable: true })
}

/** Extrai `"retryDelay": "30s"` da mensagem de erro do Gemini, se houver. */
function retryDelay(message: string): { retryAfterMs?: number } {
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(message)
  return match ? { retryAfterMs: Number(match[1]) * 1000 } : {}
}
