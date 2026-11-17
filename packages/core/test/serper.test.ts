import { describe, expect, it } from 'vitest'
import { MemoryCacheStore } from '../src/cache/memory-cache.ts'
import { SerperClient } from '../src/clients/serper.ts'
import { FACTCHECK_DOMAINS } from '../src/config.ts'
import { ConfigError, SearchError } from '../src/errors.ts'
import { UsageTracker } from '../src/usage.ts'
import { fakeFetch, fastRetry, fixtureJson, jsonResponse } from './helpers.ts'

const body = fixtureJson('serper/search-vacina.json')

describe('SerperClient', () => {
  it('envia consulta em pt-BR com a chave no cabeçalho e mapeia os resultados', async () => {
    const fetch = fakeFetch([jsonResponse(body)])
    const client = new SerperClient({ apiKey: 'chave', fetch })
    const results = await client.search('vacina dengue SUS', { num: 5 })

    const call = fetch.calls[0]!
    expect(call.url).toBe('https://google.serper.dev/search')
    expect(call.init?.headers).toMatchObject({ 'X-API-KEY': 'chave' })
    expect(JSON.parse(String(call.init?.body))).toEqual({
      q: 'vacina dengue SUS',
      gl: 'br',
      hl: 'pt-br',
      num: 10,
    })

    expect(results).toHaveLength(5)
    expect(results[0]).toEqual({
      url: 'https://www.gov.br/saude/pt-br/assuntos/noticias/2023/dezembro/vacina-dengue-sus',
      domain: 'gov.br',
      title: 'Vacina contra a dengue é incorporada ao SUS',
      snippet: expect.stringContaining('Ministério da Saúde') as unknown as string,
      publishedAt: '21 de dez. de 2023',
      position: 1,
    })
  })

  it('exclui o domínio da notícia e as agências de checagem, e descarta links inválidos', async () => {
    const client = new SerperClient({ apiKey: 'k', fetch: fakeFetch([jsonResponse(body)]) })
    const results = await client.search('q', {
      num: 10,
      excludeDomains: ['noticias.exemplo.com.br', ...FACTCHECK_DOMAINS],
    })
    expect(results.map((r) => r.domain)).toEqual([
      'gov.br',
      'estadao.com.br',
      'portal.fiocruz.br',
      'agenciabrasil.ebc.com.br',
    ])
    // A reportagem comum do Estadão fica; a seção Estadão Verifica sai.
    expect(results.some((r) => r.url.includes('estadao-verifica'))).toBe(false)
  })

  it('cacheia a resposta bruta: com e sem exclusão reaproveitam a mesma busca', async () => {
    const fetch = fakeFetch([jsonResponse(body)])
    const tracker = new UsageTracker()
    const client = new SerperClient({ apiKey: 'k', fetch, cache: new MemoryCacheStore(), tracker })
    const all = await client.search('q', { num: 10 })
    const filtered = await client.search('q', { num: 10, excludeDomains: FACTCHECK_DOMAINS })
    expect(fetch.calls).toHaveLength(1)
    expect(all.length).toBeGreaterThan(filtered.length)
    expect(tracker.snapshot()).toMatchObject({ apiCalls: { serper: 1 }, cacheHits: { serper: 1 } })
  })

  it('tenta de novo em 429 e falha com SearchError em 401', async () => {
    const ok = new SerperClient({
      apiKey: 'k',
      fetch: fakeFetch([jsonResponse({}, 429, { 'retry-after': '1' }), jsonResponse(body)]),
      retry: fastRetry,
    })
    expect(await ok.search('q', { num: 1 })).toHaveLength(1)

    const fetch = fakeFetch([jsonResponse({ message: 'Unauthorized' }, 401)])
    const bad = new SerperClient({ apiKey: 'k', fetch, retry: fastRetry })
    await expect(bad.search('q', { num: 1 })).rejects.toMatchObject({
      status: 401,
      retryable: false,
    })
    await expect(bad.search('q', { num: 1 })).rejects.toBeInstanceOf(SearchError)
  })

  it('exige a chave', () => {
    expect(() => new SerperClient({ apiKey: '' })).toThrow(ConfigError)
  })
})
