import { isRetryable, VeritasError } from '../errors.ts'

export type Sleep = (ms: number) => Promise<void>

export const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export interface RetryOptions {
  /** Número de novas tentativas após a primeira (padrão 4 → até 5 chamadas). */
  retries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  isRetryable?: (err: unknown) => boolean
  sleep?: Sleep
  /** Fonte de aleatoriedade para o jitter (injetável nos testes). */
  random?: () => number
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void
}

/**
 * Executa `fn` com backoff exponencial + jitter. Se o erro trouxer `retryAfterMs`
 * (ex.: cabeçalho Retry-After ou retryDelay do Gemini), essa espera é respeitada.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    retries = 4,
    baseDelayMs = 1000,
    maxDelayMs = 60_000,
    isRetryable: shouldRetry = isRetryable,
    sleep = realSleep,
    random = Math.random,
    onRetry,
  } = options

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) throw error
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt) * (0.5 + random() * 0.5)
      const hinted = error instanceof VeritasError ? error.retryAfterMs : undefined
      const delayMs = Math.min(maxDelayMs, Math.max(backoff, hinted ?? 0))
      onRetry?.({ attempt: attempt + 1, delayMs, error })
      await sleep(delayMs)
    }
  }
}
