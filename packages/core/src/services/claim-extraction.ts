import { z } from 'zod'
import { generateJson, type LlmClient } from '../clients/llm.ts'
import type { Article, Claim } from '../domain/schemas.ts'
import { loadPrompt, renderPrompt } from '../prompts/loader.ts'

export const ClaimExtractionOutputSchema = z.object({
  claims: z.array(
    z.object({
      text: z.string(),
      sourceSentence: z.string().optional(),
    }),
  ),
})

/** Decompõe a notícia em afirmações atômicas, autocontidas e factuais (via LLM). */
export class ClaimExtractionService {
  static readonly PROMPT_ID = 'claim-extraction'

  constructor(
    private readonly llm: LlmClient,
    private readonly config: { maxClaims: number },
  ) {}

  async extract(article: Article): Promise<Claim[]> {
    const prompt = renderPrompt(loadPrompt(ClaimExtractionService.PROMPT_ID), {
      maxClaims: this.config.maxClaims,
      title: article.title ?? '(sem título)',
      publishedAt: article.publishedAt ?? '(não informada)',
      domain: article.domain,
      text: article.text,
    })
    const { data } = await generateJson(this.llm, prompt, ClaimExtractionOutputSchema)

    // Limpa, remove repetidas e aplica o máximo (o LLM pode ignorar o limite).
    const seen = new Set<string>()
    const claims: Claim[] = []
    for (const item of data.claims) {
      const text = item.text.replace(/\s+/g, ' ').trim()
      const key = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')
      if (text.length < 10 || seen.has(key)) continue
      seen.add(key)
      const sourceSentence = item.sourceSentence?.trim()
      claims.push({
        id: `c${claims.length + 1}`,
        text,
        ...(sourceSentence ? { sourceSentence } : {}),
      })
      if (claims.length >= this.config.maxClaims) break
    }
    return claims
  }
}
