import type { z } from 'zod'
import type { ExternalApi, UsageTracker } from '../usage.ts'
import type { CacheStore } from './cache-store.ts'

export interface CachedCallOptions<T> {
  cache: CacheStore | undefined
  tracker?: UsageTracker | undefined
  api: ExternalApi
  namespace: string
  key: string
  /** Schema da resposta guardada; entradas que não passam são ignoradas (refeitas). */
  schema: z.ZodType<T>
  call: () => Promise<T>
}

/** Lê do cache se houver entrada válida; senão chama e guarda o resultado. */
export async function cachedCall<T>(options: CachedCallOptions<T>): Promise<T> {
  const { cache, tracker, api, namespace, key, schema, call } = options
  if (cache) {
    const hit = schema.safeParse(await cache.getResponse(namespace, key))
    if (hit.success) {
      tracker?.recordCacheHit(api)
      return hit.data
    }
  }
  const value = await call()
  await cache?.setResponse(namespace, key, value)
  return value
}
