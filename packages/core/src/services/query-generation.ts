import { z } from 'zod'
import { generateJson, type LlmClient } from '../clients/llm.ts'
import type { Claim } from '../domain/schemas.ts'
import { loadPrompt, renderPrompt } from '../prompts/loader.ts'

export const QueryGenerationOutputSchema = z.object({
  queries: z.array(z.object({ id: z.string(), query: z.string() })),
})

export interface QueryGenerationOutput {
  /** Consulta por id de afirmação (sempre preenchida para todas as afirmações). */
  queries: Map<string, string>
  /** Ids que usaram o texto da própria afirmação como consulta (LLM falhou ou omitiu). */
  fallbackIds: string[]
  /** Motivo, se a chamada ao LLM falhou inteira. */
  error?: string
}

/** Remove aspas e operadores de busca que o LLM às vezes coloca. */
export function sanitizeQuery(query: string): string {
  return query
    .replace(/["“”'‘’]/g, '')
    .replace(/\b(site|inurl|intitle|filetype):\S+/gi, '')
    .replace(/(^|\s)-\S+/g, ' ')
    .replace(/\s+\bOR\b\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Gera uma consulta de busca por afirmação. Todas as afirmações vão numa
 * única chamada ao LLM (economia de cota). Se falhar, usa o texto da afirmação.
 */
export class QueryGenerationService {
  static readonly PROMPT_ID = 'query-generation'

  constructor(private readonly llm: LlmClient) {}

  async generate(claims: readonly Claim[]): Promise<QueryGenerationOutput> {
    const queries = new Map<string, string>()
    let error: string | undefined
    if (claims.length > 0) {
      try {
        const prompt = renderPrompt(loadPrompt(QueryGenerationService.PROMPT_ID), {
          claims: claims.map((c) => `[${c.id}] ${c.text}`).join('\n'),
        })
        const { data } = await generateJson(this.llm, prompt, QueryGenerationOutputSchema)
        const ids = new Set(claims.map((c) => c.id))
        for (const { id, query } of data.queries) {
          const clean = sanitizeQuery(query)
          if (ids.has(id) && clean && !queries.has(id)) queries.set(id, clean)
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
      }
    }

    const fallbackIds: string[] = []
    for (const claim of claims) {
      if (!queries.has(claim.id)) {
        queries.set(claim.id, sanitizeQuery(claim.text))
        fallbackIds.push(claim.id)
      }
    }
    return { queries, fallbackIds, ...(error !== undefined && { error }) }
  }
}
