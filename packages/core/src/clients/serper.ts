import { z } from 'zod'
import type { CacheStore } from '../cache/cache-store.ts'
import { cachedCall } from '../cache/cached-call.ts'
import { ConfigError, SearchError } from '../errors.ts'
import { stableHash } from '../utils/hash.ts'
import { fetchOrThrow, type FetchFn } from '../utils/http.ts'
import { withRetry, type RetryOptions } from '../utils/retry.ts'
import { domainOf, matchesAnyDomain } from '../utils/url.ts'
import type { UsageTracker } from '../usage.ts'
import {
  SearchResultSchema,
  type SearchClient,
  type SearchOptions,
  type SearchResult,
} from './search.ts'

const SERPER_URL = 'https://google.serper.dev/search'

/** Resultados pedidos ao Serper por consulta (antes da exclusão de domínios). */
const SERPER_NUM = 10

const SerperResponseSchema = z.object({
  organic: z
    .array(
      z.object({
        title: z.string().default(''),
        link: z.string(),
        snippet: z.string().default(''),
        date: z.string().optional(),
        position: z.number().int().positive().optional(),
      }),
    )
    .default([]),
})

export interface SerperClientOptions {
  apiKey: string
  cache?: CacheStore
  tracker?: UsageTracker
  fetch?: FetchFn
  retry?: RetryOptions
}

/**
 * Cliente do Serper.dev (resultados do Google), em português do Brasil.
 * A resposta bruta é cacheada antes da exclusão de domínios, então as variantes
 * com e sem exclusão das agências reaproveitam a mesma busca.
 */
export class SerperClient implements SearchClient {
  private readonly apiKey: string
  private readonly cache: CacheStore | undefined
  private readonly tracker: UsageTracker | undefined
  private readonly fetchFn: FetchFn
  private readonly retry: RetryOptions

  constructor(options: SerperClientOptions) {
    if (!options.apiKey) throw new ConfigError('SERPER_API_KEY não definido no .env')
    this.apiKey = options.apiKey
    this.cache = options.cache
    this.tracker = options.tracker
    this.fetchFn = options.fetch ?? fetch
    this.retry = options.retry ?? {}
  }

  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const body = { q: query, gl: 'br', hl: 'pt-br', num: Math.max(SERPER_NUM, options.num) }
    const results = await cachedCall({
      cache: this.cache,
      tracker: this.tracker,
      api: 'serper',
      namespace: 'serper',
      key: stableHash(body),
      schema: z.array(SearchResultSchema),
      call: () => withRetry(() => this.request(body), this.retry),
    })
    const excluded = options.excludeDomains ?? []
    return results.filter((r) => !matchesAnyDomain(r.url, excluded)).slice(0, options.num)
  }

  private async request(body: Record<string, unknown>): Promise<SearchResult[]> {
    const res = await fetchOrThrow(
      this.fetchFn,
      SERPER_URL,
      {
        method: 'POST',
        headers: { 'X-API-KEY': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      SearchError,
      'Serper',
    )
    this.tracker?.recordCall('serper')
    const parsed = SerperResponseSchema.safeParse(await res.json())
    if (!parsed.success)
      throw new SearchError('Serper: resposta em formato inesperado', { cause: parsed.error })

    const results: SearchResult[] = []
    parsed.data.organic.forEach((item, i) => {
      let domain: string
      try {
        domain = domainOf(item.link)
      } catch {
        return // link inválido: descarta
      }
      results.push({
        url: item.link,
        domain,
        title: item.title,
        snippet: item.snippet,
        position: item.position ?? i + 1,
        ...(item.date !== undefined && { publishedAt: item.date }),
      })
    })
    return results
  }
}
