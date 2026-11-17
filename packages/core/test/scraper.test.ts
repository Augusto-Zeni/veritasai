import { describe, expect, it } from 'vitest'
import { ScrapeError } from '../src/errors.ts'
import { ScraperService } from '../src/services/scraper.ts'
import { FakeReader } from './fakes.ts'

const URL_LIMPA = 'https://noticias.exemplo.com.br/saude/vacina-dengue'

describe('ScraperService', () => {
  it('normaliza a URL, limpa o markdown do Jina e preenche o Article', async () => {
    const reader = new FakeReader({
      [URL_LIMPA]: {
        url: URL_LIMPA,
        method: 'jina',
        title: 'Vacina',
        publishedAt: '2024-02-05',
        text: '# Vacina\n\nTexto com [link](https://x.com) e **negrito**.',
      },
    })
    const out = await new ScraperService(reader, { maxArticleChars: 1000 }).scrape(
      'https://www.noticias.exemplo.com.br/saude/vacina-dengue/?utm_source=zap#x',
    )
    expect(reader.reads).toEqual([URL_LIMPA])
    expect(out).toEqual({
      article: {
        url: URL_LIMPA,
        domain: 'noticias.exemplo.com.br',
        title: 'Vacina',
        publishedAt: '2024-02-05',
        text: 'Vacina\n\nTexto com link e negrito.',
      },
      method: 'jina',
      truncated: false,
      originalChars: 33,
    })
  })

  it('trunca em maxArticleChars e registra', async () => {
    const text = 'Frase de teste. '.repeat(100).trim()
    const reader = new FakeReader({ [URL_LIMPA]: { url: URL_LIMPA, method: 'readability', text } })
    const out = await new ScraperService(reader, { maxArticleChars: 100 }).scrape(URL_LIMPA)
    expect(out.truncated).toBe(true)
    expect(out.article.text.length).toBeLessThanOrEqual(100)
    expect(out.originalChars).toBe(text.length)
    expect(out.method).toBe('readability')
  })

  it('URL inválida ou texto vazio viram ScrapeError', async () => {
    const reader = new FakeReader({
      [URL_LIMPA]: { url: URL_LIMPA, method: 'jina', text: '![](a.png)' },
    })
    const scraper = new ScraperService(reader, { maxArticleChars: 100 })
    await expect(scraper.scrape('não é url')).rejects.toBeInstanceOf(ScrapeError)
    await expect(scraper.scrape(URL_LIMPA)).rejects.toBeInstanceOf(ScrapeError)
  })
})
