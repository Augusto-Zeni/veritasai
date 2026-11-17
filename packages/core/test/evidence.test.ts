import { describe, expect, it } from 'vitest'
import type { ReadResult } from '../src/clients/reader.ts'
import type { Claim } from '../src/domain/schemas.ts'
import { ScrapeError } from '../src/errors.ts'
import { EvidenceService } from '../src/services/evidence.ts'
import { FakeReader, searchResult } from './fakes.ts'
import { fixtureJson } from './helpers.ts'

const claim: Claim = {
  id: 'c2',
  text: 'O Ministério da Saúde distribuirá 1,2 milhão de doses da vacina contra a dengue até março de 2024.',
}

const jina = fixtureJson('jina/artigo.json') as { data: { content: string; title: string } }
const relevantPage = (url: string): ReadResult => ({
  url,
  method: 'jina',
  title: jina.data.title,
  publishedAt: '2024-02-05',
  text: jina.data.content,
})
const irrelevantPage = (url: string): ReadResult => ({
  url,
  method: 'readability',
  text: 'O campeonato estadual de futebol terminou neste domingo com vitória do time visitante por dois a zero, diante de um estádio lotado.',
})

const config = { evidencePages: 3, snippetsPerPage: 3, maxArticleChars: 20000 }

describe('EvidenceService', () => {
  it('seleciona trechos relevantes, numera E1..En e ignora páginas sem relação', async () => {
    const results = [
      searchResult('https://gov.br/a'),
      searchResult('https://esporte.com/b'),
      searchResult('https://agenciabrasil.ebc.com.br/c'),
    ]
    const reader = new FakeReader({
      'https://gov.br/a': relevantPage('https://gov.br/a'),
      'https://esporte.com/b': irrelevantPage('https://esporte.com/b'),
      'https://agenciabrasil.ebc.com.br/c': relevantPage('https://agenciabrasil.ebc.com.br/c'),
    })
    const out = await new EvidenceService(reader, config).collect(claim, results)

    expect(out.pagesRead).toBe(3)
    expect(out.failures).toEqual([])
    expect(out.evidences.map((e) => e.id)).toEqual(out.evidences.map((_, i) => `E${i + 1}`))
    expect(out.evidences.some((e) => e.domain === 'esporte.com')).toBe(false)
    expect(out.evidences[0]).toMatchObject({
      url: 'https://gov.br/a',
      domain: 'gov.br',
      title: 'Governo amplia vacinação contra a dengue',
      publishedAt: '2024-02-05',
    })
    expect(out.evidences[0]!.snippet).toContain('1,2 milhão de doses')
    // no máximo snippetsPerPage por página
    expect(out.evidences.filter((e) => e.domain === 'gov.br').length).toBeLessThanOrEqual(3)
  })

  it('lê no máximo evidencePages páginas e repõe as que falharam com os próximos resultados', async () => {
    const results = ['a', 'b', 'c', 'd', 'e'].map((x) => searchResult(`https://site-${x}.com/`))
    const reader = new FakeReader({
      'https://site-a.com/': new ScrapeError('Jina: HTTP 403'),
      'https://site-b.com/': relevantPage('https://site-b.com/'),
      'https://site-c.com/': relevantPage('https://site-c.com/'),
      'https://site-d.com/': relevantPage('https://site-d.com/'),
      'https://site-e.com/': relevantPage('https://site-e.com/'),
    })
    const out = await new EvidenceService(reader, config).collect(claim, results)
    expect(reader.reads).toEqual([
      'https://site-a.com/',
      'https://site-b.com/',
      'https://site-c.com/',
      'https://site-d.com/',
    ])
    expect(out.pagesRead).toBe(3)
    expect(out.failures).toEqual([{ url: 'https://site-a.com/', reason: 'Jina: HTTP 403' }])
  })

  it('usa o snippet do buscador quando a página não pode ser lida, se for relevante', async () => {
    const results = [
      searchResult('https://gov.br/x', {
        snippet:
          'Ministério da Saúde vai distribuir 1,2 milhão de doses da vacina contra a dengue até março.',
      }),
      searchResult('https://outro.com/y', { snippet: 'Receita de bolo de cenoura com cobertura.' }),
    ]
    const reader = new FakeReader({
      'https://gov.br/x': new ScrapeError('paywall'),
      'https://outro.com/y': new ScrapeError('paywall'),
    })
    const out = await new EvidenceService(reader, config).collect(claim, results)
    expect(out.evidences).toHaveLength(1)
    expect(out.evidences[0]).toMatchObject({ id: 'E1', url: 'https://gov.br/x' })
  })

  it('sem resultados de busca, devolve lista vazia', async () => {
    const out = await new EvidenceService(new FakeReader({}), config).collect(claim, [])
    expect(out).toEqual({ evidences: [], pagesRead: 0, failures: [] })
  })
})
