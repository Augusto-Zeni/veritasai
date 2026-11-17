/**
 * Erros tipados dos serviços externos. O pipeline usa `retryable` para decidir
 * se tenta de novo e o tipo do erro para degradar com elegância
 * (ex.: falha numa afirmação → INSUFICIENTE com o motivo registrado).
 */

export interface VeritasErrorOptions {
  cause?: unknown
  /** Vale a pena tentar de novo (429 temporário, 5xx, timeout). */
  retryable?: boolean
  /** Espera sugerida pelo servidor antes da próxima tentativa. */
  retryAfterMs?: number
  /** Status HTTP, quando houver. */
  status?: number
}

export abstract class VeritasError extends Error {
  abstract readonly code: string
  readonly retryable: boolean
  readonly retryAfterMs: number | undefined
  readonly status: number | undefined

  constructor(message: string, options: VeritasErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = new.target.name
    this.retryable = options.retryable ?? false
    this.retryAfterMs = options.retryAfterMs
    this.status = options.status
  }
}

/** Configuração ausente ou inválida (ex.: GEMINI_MODEL vazio). */
export class ConfigError extends VeritasError {
  readonly code = 'CONFIG'
}

/** Falha ao extrair o texto da notícia. */
export class ScrapeError extends VeritasError {
  readonly code = 'SCRAPE'
}

/** Falha na API de busca. */
export class SearchError extends VeritasError {
  readonly code = 'SEARCH'
}

/** Falha genérica do LLM (rede, 5xx, resposta vazia). */
export class LlmError extends VeritasError {
  readonly code: string = 'LLM'
}

/** Cota do LLM esgotada: 429 do provedor ou limite local (LLM_RPD) atingido. */
export class LlmQuotaError extends LlmError {
  override readonly code = 'LLM_QUOTA'
}

/** O LLM respondeu, mas a saída não é JSON válido ou não passa no schema Zod. */
export class LlmOutputError extends LlmError {
  override readonly code = 'LLM_OUTPUT'
  readonly rawText: string

  constructor(message: string, rawText: string, options: VeritasErrorOptions = {}) {
    super(message, options)
    this.rawText = rawText
  }
}

export function isRetryable(err: unknown): boolean {
  return err instanceof VeritasError && err.retryable
}

/** Status HTTP que valem nova tentativa. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

/** Lê o cabeçalho Retry-After (segundos ou data HTTP). */
export function parseRetryAfter(
  value: string | null,
  now: number = Date.now(),
): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, date - now)
}
