import { describe, expect, it } from 'vitest'
import { FACTCHECK_DOMAINS, TRUSTED_DOMAINS } from '../src/config.ts'
import { SearchService, type SearchServiceConfig } from '../src/services/search.ts'
import { FakeSearch, searchResult } from './fakes.ts'

const results = [
  searchResult('https://noticias.exemplo.com.br/a'),
  searchResult('https://aosfatos.org/b'),
  searchResult('https://blog.qualquer.com/c'),
  searchResult('https://www.gov.br/saude/d'),
]

const base: SearchServiceConfig = {
  searchTopK: 5,
  excludeFactcheckDomains: false,
  factcheckDomains: FACTCHECK_DOMAINS,
  useTrustedDomains: false,
  trustedDomains: TRUSTED_DOMAINS,
}

describe('SearchService', () => {
  it('sempre exclui o domínio da própria notícia e repassa o top K', async () => {
    const client = new FakeSearch(results)
    const out = await new SearchService(client, base).search('q', 'noticias.exemplo.com.br')
    expect(client.calls[0]!.options).toEqual({
      num: 5,
      excludeDomains: ['noticias.exemplo.com.br'],
    })
    expect(out.map((r) => r.domain)).toEqual(['aosfatos.org', 'blog.qualquer.com', 'gov.br'])
  })

  it('com excludeFactcheckDomains, exclui também as agências', async () => {
    const client = new FakeSearch(results)
    const service = new SearchService(client, { ...base, excludeFactcheckDomains: true })
    const out = await service.search('q', 'noticias.exemplo.com.br')
    expect(client.calls[0]!.options.excludeDomains).toEqual([
      'noticias.exemplo.com.br',
      ...FACTCHECK_DOMAINS,
    ])
    expect(out.map((r) => r.domain)).toEqual(['blog.qualquer.com', 'gov.br'])
  })

  it('com excludeFactcheckDomains, exclui o domínio atual da Lupa (agencialupa.org)', async () => {
    const client = new FakeSearch([
      searchResult('https://www.agencialupa.org/checagem/2026/08/06/x/'),
      searchResult('https://blog.qualquer.com/c'),
    ])
    const service = new SearchService(client, { ...base, excludeFactcheckDomains: true })
    const out = await service.search('q', 'texto.invalid')
    expect(out.map((r) => r.domain)).toEqual(['blog.qualquer.com'])
  })

  it('com useTrustedDomains, coloca domínios confiáveis primeiro sem perder os demais', async () => {
    const service = new SearchService(new FakeSearch(results), { ...base, useTrustedDomains: true })
    const out = await service.search('q', 'noticias.exemplo.com.br')
    expect(out.map((r) => r.domain)).toEqual(['gov.br', 'aosfatos.org', 'blog.qualquer.com'])
  })
})
