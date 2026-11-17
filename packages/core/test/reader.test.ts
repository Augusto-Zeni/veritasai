import { describe, expect, it } from 'vitest'
import { MemoryCacheStore } from '../src/cache/memory-cache.ts'
import { JinaReader } from '../src/clients/jina.ts'
import { extractWithReadability, ReadabilityReader } from '../src/clients/readability.ts'
import { FallbackReader, type ReaderClient, type ReadResult } from '../src/clients/reader.ts'
import { ScrapeError } from '../src/errors.ts'
import { UsageTracker } from '../src/usage.ts'
import {
  fakeFetch,
  fastRetry,
  fixture,
  fixtureJson,
  htmlResponse,
  jsonResponse,
} from './helpers.ts'

const URL_NOTICIA =
  'https://www.noticias.exemplo.com.br/saude/vacina-dengue?utm_source=whatsapp#topo'
const URL_NORMALIZADA = 'https://noticias.exemplo.com.br/saude/vacina-dengue'

describe('JinaReader', () => {
  it('chama r.jina.ai com a URL normalizada e a chave; mapeia título, texto e data', async () => {
    const fetch = fakeFetch([jsonResponse(fixtureJson('jina/artigo.json'))])
    const reader = new JinaReader({ apiKey: 'jina-key', fetch })
    const result = await reader.read(URL_NOTICIA)

    expect(fetch.calls[0]?.url).toBe(`https://r.jina.ai/${URL_NORMALIZADA}`)
    expect(fetch.calls[0]?.init?.headers).toMatchObject({
      Authorization: 'Bearer jina-key',
      Accept: 'application/json',
    })
    expect(result).toMatchObject({
      url: URL_NORMALIZADA,
      method: 'jina',
      title: 'Governo amplia vacinação contra a dengue',
      publishedAt: '2024-02-05T10:00:00-03:00',
    })
    expect(result.text).toMatch(/^O Ministério da Saúde anunciou/)
  })

  it('usa o cache na segunda leitura (mesmo com URL de rastreamento diferente)', async () => {
    const fetch = fakeFetch([jsonResponse(fixtureJson('jina/artigo.json'))])
    const tracker = new UsageTracker()
    const reader = new JinaReader({ fetch, cache: new MemoryCacheStore(), tracker })
    await reader.read(URL_NOTICIA)
    await reader.read(`${URL_NORMALIZADA}?utm_campaign=outra`)
    expect(fetch.calls).toHaveLength(1)
    expect(tracker.snapshot()).toMatchObject({ apiCalls: { jina: 1 }, cacheHits: { jina: 1 } })
  })

  it('erro HTTP vira ScrapeError', async () => {
    const reader = new JinaReader({ fetch: fakeFetch([jsonResponse({}, 451)]), retry: fastRetry })
    await expect(reader.read(URL_NOTICIA)).rejects.toBeInstanceOf(ScrapeError)
  })
})

describe('Readability', () => {
  it('extrai título, data e corpo do artigo, sem menu e rodapé', () => {
    const result = extractWithReadability(fixture('html/artigo.html'), URL_NORMALIZADA)
    expect(result.method).toBe('readability')
    expect(result.title).toMatch(/Governo amplia vacinação contra a dengue/)
    expect(result.publishedAt).toBe('2024-02-05T10:00:00-03:00')
    expect(result.text).toContain('1,2 milhão de doses')
    expect(result.text).not.toContain('Mais lidas')
    expect(result.text).not.toContain('Assine')
  })

  it('página sem conteúdo vira ScrapeError', () => {
    expect(() => extractWithReadability('<html><body></body></html>', URL_NORMALIZADA)).toThrow(
      ScrapeError,
    )
  })

  it('ReadabilityReader baixa o HTML com User-Agent do projeto', async () => {
    const fetch = fakeFetch([htmlResponse(fixture('html/artigo.html'))])
    const result = await new ReadabilityReader({ fetch }).read(URL_NOTICIA)
    expect(fetch.calls[0]?.url).toBe(URL_NORMALIZADA)
    expect(fetch.calls[0]?.init?.headers).toMatchObject({
      'User-Agent': expect.stringMatching(/^VeritasAI/) as unknown as string,
    })
    expect(result.text).toContain('Takeda')
  })
})

describe('FallbackReader', () => {
  const stub = (result: ReadResult | Error): ReaderClient => ({
    read: async () => {
      if (result instanceof Error) throw result
      return result
    },
  })
  const long = (method: ReadResult['method'], n = 600): ReadResult => ({
    url: 'u',
    text: 'a'.repeat(n),
    method,
  })

  it('usa o primário quando o texto é suficiente', async () => {
    const reader = new FallbackReader({
      primary: stub(long('jina')),
      fallback: stub(new Error('não deveria')),
    })
    expect((await reader.read('u')).method).toBe('jina')
  })

  it('cai para o secundário quando o primário falha, registrando o motivo', async () => {
    const reasons: string[] = []
    const reader = new FallbackReader({
      primary: stub(new ScrapeError('Jina: HTTP 451')),
      fallback: stub(long('readability')),
      onFallback: ({ reason }) => void reasons.push(reason),
    })
    expect((await reader.read('u')).method).toBe('readability')
    expect(reasons).toEqual(['Jina: HTTP 451'])
  })

  it('cai para o secundário quando o texto do primário é curto (< 500)', async () => {
    const reader = new FallbackReader({
      primary: stub(long('jina', 100)),
      fallback: stub(long('readability', 800)),
    })
    expect((await reader.read('u')).method).toBe('readability')
  })

  it('se o secundário também falhar, mantém o texto curto do primário', async () => {
    const reader = new FallbackReader({
      primary: stub(long('jina', 100)),
      fallback: stub(new Error('falhou')),
    })
    expect((await reader.read('u')).text).toHaveLength(100)
  })

  it('se os dois falharem, lança ScrapeError', async () => {
    const reader = new FallbackReader({
      primary: stub(new Error('a')),
      fallback: stub(new Error('b')),
    })
    await expect(reader.read('u')).rejects.toBeInstanceOf(ScrapeError)
  })
})
