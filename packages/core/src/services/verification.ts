import { z } from 'zod'
import { generateJson, type LlmClient } from '../clients/llm.ts'
import { ClaimLabelSchema, type Claim, type ClaimLabel, type Evidence } from '../domain/schemas.ts'
import { loadPrompt, renderPrompt } from '../prompts/loader.ts'

export const VerificationOutputSchema = z.object({
  label: ClaimLabelSchema,
  rationale: z.string(),
  evidenceIdsUsed: z.array(z.string()),
})

export interface VerificationOutput {
  label: ClaimLabel
  rationale: string
  evidenceIdsUsed: string[]
}

export const NO_EVIDENCE_RATIONALE =
  'Nenhuma evidência relevante foi encontrada para esta afirmação.'

/** Formata as evidências para o prompt: id, fonte, título, data e trecho. */
export function formatEvidences(evidences: readonly Evidence[]): string {
  return evidences
    .map((e) => {
      const date = e.publishedAt ? `, publicada em ${e.publishedAt}` : ''
      return `[${e.id}] Fonte: ${e.domain} — "${e.title}"${date}\n${e.snippet}`
    })
    .join('\n\n')
}

/**
 * Classifica uma afirmação usando somente as evidências fornecidas.
 * Sem evidências, responde INSUFICIENTE sem chamar o LLM.
 */
export class VerificationService {
  static readonly PROMPT_ID = 'verification'

  constructor(private readonly llm: LlmClient) {}

  async verify(claim: Claim, evidences: readonly Evidence[]): Promise<VerificationOutput> {
    if (evidences.length === 0) {
      return { label: 'INSUFICIENTE', rationale: NO_EVIDENCE_RATIONALE, evidenceIdsUsed: [] }
    }
    const prompt = renderPrompt(loadPrompt(VerificationService.PROMPT_ID), {
      claim: claim.text,
      evidences: formatEvidences(evidences),
    })
    const { data } = await generateJson(
      this.llm,
      { ...prompt, temperature: 0 },
      VerificationOutputSchema,
    )
    // Descarta ids inventados pelo LLM.
    const valid = new Set(evidences.map((e) => e.id))
    const evidenceIdsUsed = [
      ...new Set(data.evidenceIdsUsed.map((id) => id.trim().toUpperCase())),
    ].filter((id) => valid.has(id))
    return { label: data.label, rationale: data.rationale.trim(), evidenceIdsUsed }
  }
}
