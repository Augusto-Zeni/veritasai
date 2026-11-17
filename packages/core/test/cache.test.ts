import { afterEach, describe, expect, it } from 'vitest'
import type { CacheStore } from '../src/cache/cache-store.ts'
import { MemoryCacheStore } from '../src/cache/memory-cache.ts'
import { SqliteCacheStore } from '../src/cache/sqlite-cache.ts'

const stores: Array<[string, () => CacheStore]> = [
  ['MemoryCacheStore', () => new MemoryCacheStore()],
  ['SqliteCacheStore', () => new SqliteCacheStore(':memory:')],
]

describe.each(stores)('%s', (_name, make) => {
  let store: CacheStore
  afterEach(async () => store.close())

  it('guarda e lê verificações por (url_hash, config_hash)', async () => {
    store = make()
    expect(await store.getVerification('u1', 'c1')).toBeUndefined()
    await store.setVerification('u1', 'c1', { verdict: 'FALSO' })
    expect(await store.getVerification('u1', 'c1')).toEqual({ verdict: 'FALSO' })
    expect(await store.getVerification('u1', 'c2')).toBeUndefined()
  })

  it('separa respostas por namespace e sobrescreve a mesma chave', async () => {
    store = make()
    await store.setResponse('gemini-x', 'k', { text: 'a' })
    await store.setResponse('serper', 'k', [1, 2])
    await store.setResponse('gemini-x', 'k', { text: 'b' })
    expect(await store.getResponse('gemini-x', 'k')).toEqual({ text: 'b' })
    expect(await store.getResponse('serper', 'k')).toEqual([1, 2])
    expect(await store.getResponse('jina', 'k')).toBeUndefined()
  })
})
