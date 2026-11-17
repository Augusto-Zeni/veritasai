import type { SearchClient, SearchResult } from '../clients/search.ts'
import { matchesAnyDomain } from '../utils/url.ts'

export interface SearchServiceConfig {
  searchTopK: number
  excludeFactcheckDomains: boolean
  factcheckDomains: readonly string[]
  useTrustedDomains: boolean
  trustedDomains: readonly string[]
}

/**
 * Busca evidências para uma consulta. Sempre exclui o domínio da própria notícia
 * (evita autoconfirmação); com `excludeFactcheckDomains`, exclui também as agências
 * de checagem (evita vazamento de gabarito na avaliação).
 */
export class SearchService {
  constructor(
    private readonly client: SearchClient,
    private readonly config: SearchServiceConfig,
  ) {}

  excludedDomains(articleDomain: string): string[] {
    return [
      articleDomain,
      ...(this.config.excludeFactcheckDomains ? this.config.factcheckDomains : []),
    ]
  }

  async search(query: string, articleDomain: string): Promise<SearchResult[]> {
    const results = await this.client.search(query, {
      num: this.config.searchTopK,
      excludeDomains: this.excludedDomains(articleDomain),
    })
    if (!this.config.useTrustedDomains) return results
    // Ordenação estável: domínios confiáveis primeiro, mantendo o ranking original dentro de cada grupo.
    const trusted = (r: SearchResult) => matchesAnyDomain(r.url, this.config.trustedDomains)
    return [...results.filter(trusted), ...results.filter((r) => !trusted(r))]
  }
}
