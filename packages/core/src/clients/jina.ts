import { z } from 'zod'
import type { CacheStore } from '../cache/cache-store.ts'
import { cachedCall } from '../cache/cached-call.ts'
import { ScrapeError } from '../errors.ts'
import { normalizeUrl } from '../utils/url.ts'
import { fetchOrThrow, type FetchFn } from '../utils/http.ts'
import { withRetry, type RetryOptions } from '../utils/retry.ts'
import type { UsageTracker } from '../usage.ts'
import { ReadResultSchema, type ReaderClient, type ReadResult } from './reader.ts'

const JINA_URL = 'https://r.jina.ai/'

const JinaResponseSchema = z.object({
  data: z.object({
    title: z.string().optional(),
    content: z.string(),
    publishedTime: z.string().optional(),
  }),
})

export interface JinaReaderOptions {
  /** Opcional: sem chave funciona com limite menor. */
  apiKey?: string
  cache?: CacheStore
  tracker?: UsageTracker
  fetch?: FetchFn
  retry?: RetryOptions
}

/** Jina Reader (r.jina.ai): devolve o conteúdo principal da página em markdown. */
export class JinaReader implements ReaderClient {
  constructor(private readonly options: JinaReaderOptions = {}) {}

  read(url: string): Promise<ReadResult> {
    const target = normalizeUrl(url)
    return cachedCall({
      cache: this.options.cache,
      tracker: this.options.tracker,
      api: 'jina',
      namespace: 'jina',
      key: target,
      schema: ReadResultSchema,
      call: () => withRetry(() => this.request(target), this.options.retry ?? {}),
    })
  }

  private async request(url: string): Promise<ReadResult> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Retain-Images': 'none',
    }
    if (this.options.apiKey) headers.Authorization = `Bearer ${this.options.apiKey}`
    const res = await fetchOrThrow(
      this.options.fetch ?? fetch,
      JINA_URL + url,
      { headers },
      ScrapeError,
      'Jina',
    )
    this.options.tracker?.recordCall('jina')
    const parsed = JinaResponseSchema.safeParse(await res.json())
    if (!parsed.success)
      throw new ScrapeError('Jina: resposta em formato inesperado', { cause: parsed.error })
    const { title, content, publishedTime } = parsed.data.data
    return {
      url,
      text: content.trim(),
      method: 'jina',
      ...(title ? { title } : {}),
      ...(publishedTime ? { publishedAt: publishedTime } : {}),
    }
  }
}
