import { z } from 'zod'

export const SearchResultSchema = z.object({
  url: z.string(),
  domain: z.string(),
  title: z.string(),
  snippet: z.string(),
  publishedAt: z.string().optional(),
  /** Posição original no ranking do buscador (1 = primeiro). */
  position: z.number().int().positive(),
})
export type SearchResult = z.infer<typeof SearchResultSchema>

export interface SearchOptions {
  /** Quantos resultados devolver (depois da exclusão de domínios). */
  num: number
  /**
   * Domínios excluídos dos resultados: o da própria notícia e,
   * com EXCLUDE_FACTCHECK_DOMAINS, os das agências de checagem.
   */
  excludeDomains?: readonly string[]
}

export interface SearchClient {
  search(query: string, options: SearchOptions): Promise<SearchResult[]>
}
