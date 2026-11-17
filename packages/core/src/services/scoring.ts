/**
 * Scoring: agrega os rótulos das afirmações em um veredito para a notícia.
 *
 *   s = (n_s - n_c) / (n_s + n_c)   em [-1, 1]; null se n_s + n_c = 0
 *   c = (n_s + n_c) / N             em [0, 1];  0 se N = 0
 *
 *   VERDADEIRO  se c ≥ coverageMin e s ≥ trueMin
 *   FALSO       se c ≥ coverageMin e s ≤ falseMax
 *   IMPRECISO   caso contrário
 *
 * Função pura: não depende de I/O nem de estado global.
 */
import { DEFAULT_SCORING_THRESHOLDS, type ScoringThresholds } from '../config.ts'
import type { ClaimLabel, NewsVerdict } from '../domain/schemas.ts'

export interface ScoreResult {
  score: number | null
  coverage: number
  verdict: NewsVerdict
  counts: { supported: number; contradicted: number; insufficient: number; total: number }
}

/**
 * Tolerância para comparar com os limiares: evita que um erro de arredondamento
 * (ex.: 0.49999999999999994) jogue um caso de fronteira para o lado errado.
 */
const EPSILON = 1e-9

export function computeScore(
  labels: readonly ClaimLabel[],
  thresholds: ScoringThresholds = DEFAULT_SCORING_THRESHOLDS,
): ScoreResult {
  let supported = 0
  let contradicted = 0
  let insufficient = 0
  for (const label of labels) {
    if (label === 'SUPORTADA') supported++
    else if (label === 'CONTRADITA') contradicted++
    else insufficient++
  }
  const total = labels.length
  const decided = supported + contradicted

  const score = decided === 0 ? null : (supported - contradicted) / decided
  const coverage = total === 0 ? 0 : decided / total

  let verdict: NewsVerdict = 'IMPRECISO'
  if (score !== null && coverage >= thresholds.coverageMin - EPSILON) {
    if (score >= thresholds.trueMin - EPSILON) verdict = 'VERDADEIRO'
    else if (score <= thresholds.falseMax + EPSILON) verdict = 'FALSO'
  }

  return { score, coverage, verdict, counts: { supported, contradicted, insufficient, total } }
}
