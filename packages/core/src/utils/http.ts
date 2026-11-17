import {
  isRetryableStatus,
  parseRetryAfter,
  type VeritasError,
  type VeritasErrorOptions,
} from '../errors.ts'

export type FetchFn = typeof fetch

export const DEFAULT_TIMEOUT_MS = 20_000

/** User-Agent genérico do projeto. */
export const USER_AGENT = 'VeritasAI/0.1 (pesquisa academica; verificacao de noticias)'

type ErrorFactory = new (message: string, options?: VeritasErrorOptions) => VeritasError

/**
 * `fetch` com timeout que converte falhas de rede e status HTTP de erro
 * no erro tipado do serviço (`SearchError`, `ScrapeError`...).
 */
export async function fetchOrThrow(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
  ErrorType: ErrorFactory,
  label: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  let res: Response
  try {
    res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new ErrorType(`${label}: falha de rede (${message})`, { cause, retryable: true })
  }
  if (!res.ok) {
    const retryAfterMs = parseRetryAfter(res.headers.get('retry-after'))
    throw new ErrorType(`${label}: HTTP ${res.status}`, {
      status: res.status,
      retryable: isRetryableStatus(res.status),
      ...(retryAfterMs !== undefined && { retryAfterMs }),
    })
  }
  return res
}
