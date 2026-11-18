/**
 * Amostra de afirmações para rotulação manual (nível da afirmação).
 *
 * Gera dois arquivos separados para a rotulação ser CEGA: quem rotula não vê o rótulo
 * do sistema (evita viés de ancoragem). O Kappa compara os dois depois.
 */
import { CLAIM_LABELS, type ClaimLabel } from '@veritasai/core'
import { sampleWithSeed } from './prng.ts'
import type { RunRecord } from './runs.ts'

export const MANUAL_COLUMNS = [
  'amostra_id',
  'noticia_id',
  'claim_id',
  'afirmacao',
  'evidencias',
  'rotulo_manual',
  'observacao',
] as const

export const SYSTEM_COLUMNS = ['amostra_id', 'rotulo_sistema', 'justificativa_sistema'] as const

export interface SampledClaim {
  manual: Record<(typeof MANUAL_COLUMNS)[number], string>
  system: Record<(typeof SYSTEM_COLUMNS)[number], string>
}

export function sampleClaims(
  records: readonly RunRecord[],
  n: number,
  seed: number,
): SampledClaim[] {
  // Ordem estável antes do sorteio: o resultado não depende da ordem do results.jsonl.
  const all = records
    .flatMap((r) => r.result.claims.map((c) => ({ record: r, claim: c })))
    .sort((a, b) =>
      a.record.id === b.record.id
        ? a.claim.claim.id.localeCompare(b.claim.claim.id, 'en', { numeric: true })
        : a.record.id.localeCompare(b.record.id, 'en', { numeric: true }),
    )
  return sampleWithSeed(all, n, seed).map(({ record, claim }, i) => {
    const amostraId = `A${String(i + 1).padStart(3, '0')}`
    const evidencias = claim.evidences
      .map((e) => `[${e.id}] ${e.domain} — ${e.title}\n${e.snippet}\n${e.url}`)
      .join('\n\n')
    return {
      manual: {
        amostra_id: amostraId,
        noticia_id: record.id,
        claim_id: claim.claim.id,
        afirmacao: claim.claim.text,
        evidencias: evidencias || '(nenhuma evidência encontrada)',
        rotulo_manual: '',
        observacao: '',
      },
      system: {
        amostra_id: amostraId,
        rotulo_sistema: claim.label,
        justificativa_sistema: claim.rationale,
      },
    }
  })
}

const stripAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')

/** Aceita o rótulo completo ou abreviado (S, C, I), sem diferenciar maiúsculas e acentos. */
export function normalizeManualLabel(raw: string): ClaimLabel | null {
  const v = stripAccents(raw.trim().toUpperCase())
  if (!v) return null
  const aliases: Record<string, ClaimLabel> = { S: 'SUPORTADA', C: 'CONTRADITA', I: 'INSUFICIENTE' }
  if (aliases[v]) return aliases[v]
  const full = CLAIM_LABELS.find((l) => l === v)
  if (full) return full
  throw new Error(
    `Rótulo manual inválido: "${raw}" (use SUPORTADA, CONTRADITA, INSUFICIENTE ou S/C/I)`,
  )
}
