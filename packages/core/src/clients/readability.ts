import { Readability } from '@mozilla/readability'
import { JSDOM, VirtualConsole } from 'jsdom'
import type { CacheStore } from '../cache/cache-store.ts'
import { cachedCall } from '../cache/cached-call.ts'
import { ScrapeError } from '../errors.ts'
import { fetchOrThrow, USER_AGENT, type FetchFn } from '../utils/http.ts'
import { withRetry, type RetryOptions } from '../utils/retry.ts'
import { normalizeUrl } from '../utils/url.ts'
import type { UsageTracker } from '../usage.ts'
import { ReadResultSchema, type ReaderClient, type ReadResult } from './reader.ts'

export interface ReadabilityReaderOptions {
  cache?: CacheStore
  tracker?: UsageTracker
  fetch?: FetchFn
  retry?: RetryOptions
}

/** Baixa o HTML e extrai o conteúdo com @mozilla/readability (fallback do Jina). */
export class ReadabilityReader implements ReaderClient {
  constructor(private readonly options: ReadabilityReaderOptions = {}) {}

  read(url: string): Promise<ReadResult> {
    const target = normalizeUrl(url)
    return cachedCall({
      cache: this.options.cache,
      tracker: this.options.tracker,
      api: 'readability',
      namespace: 'readability',
      key: target,
      schema: ReadResultSchema,
      call: () => withRetry(() => this.request(target), this.options.retry ?? {}),
    })
  }

  private async request(url: string): Promise<ReadResult> {
    const res = await fetchOrThrow(
      this.options.fetch ?? fetch,
      url,
      { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' } },
      ScrapeError,
      'Readability',
    )
    this.options.tracker?.recordCall('readability')
    return extractWithReadability(await res.text(), url)
  }
}

/** Extração pura (sem rede), testável com HTML gravado. */
export function extractWithReadability(html: string, url: string): ReadResult {
  // VirtualConsole vazio: não polui o log com erros de CSS da página.
  const dom = new JSDOM(html, { url, virtualConsole: new VirtualConsole() })
  try {
    const article = new Readability(dom.window.document).parse()
    const text = article?.textContent
      ?.replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim()
    if (!article || !text)
      throw new ScrapeError(`Readability: nenhum conteúdo encontrado em ${url}`)
    const publishedAt = article.publishedTime ?? undefined
    return {
      url,
      text,
      method: 'readability',
      ...(article.title ? { title: article.title } : {}),
      ...(publishedAt ? { publishedAt } : {}),
    }
  } finally {
    dom.window.close()
  }
}
