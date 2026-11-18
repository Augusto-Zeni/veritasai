/**
 * Calibração dos limiares do scoring por busca em grade, maximizando o macro-F1.
 * Recalcula os vereditos a partir dos rótulos das afirmações já gravados (sem APIs).
 * Deve ser usada SÓ no split de calibração.
 */
import { DEFAULT_SCORING_THRESHOLDS, type ScoringThresholds } from '@veritasai/core'
import { buildMetrics } from './report.ts'
import type { RunRecord } from './runs.ts'

export interface CalibrationCandidate {
  thresholds: ScoringThresholds
  macroF1: number
  accuracy: number
}

export interface CalibrationResult {
  best: CalibrationCandidate
  defaults: CalibrationCandidate
  evaluated: number
  /** Quantas combinações empataram com a melhor (indício de pouco dado para calibrar). */
  ties: number
}

const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = []
  for (let i = 0; from + i * step <= to + 1e-9; i++) out.push(Number((from + i * step).toFixed(2)))
  return out
}

export const DEFAULT_GRID = {
  coverageMin: range(0.2, 0.8, 0.1),
  trueMin: range(0, 0.9, 0.1),
  falseMax: range(-0.9, 0, 0.1),
}

const distance = (a: ScoringThresholds, b: ScoringThresholds) =>
  Math.abs(a.coverageMin - b.coverageMin) +
  Math.abs(a.trueMin - b.trueMin) +
  Math.abs(a.falseMax - b.falseMax)

/**
 * Critério: maior macro-F1; empate → maior acurácia; empate → mais próximo dos limiares
 * padrão (evita mudar sem necessidade, reduz sobreajuste).
 */
export function calibrate(records: readonly RunRecord[], grid = DEFAULT_GRID): CalibrationResult {
  const evaluate = (thresholds: ScoringThresholds): CalibrationCandidate => {
    const m = buildMetrics(records, {
      variant: '',
      split: '',
      datasetItems: 0,
      failed: 0,
      thresholds,
    })
    return { thresholds, macroF1: m.macroF1, accuracy: m.accuracy }
  }
  const eps = 1e-9
  const better = (a: CalibrationCandidate, b: CalibrationCandidate) => {
    if (Math.abs(a.macroF1 - b.macroF1) > eps) return a.macroF1 > b.macroF1
    if (Math.abs(a.accuracy - b.accuracy) > eps) return a.accuracy > b.accuracy
    return (
      distance(a.thresholds, DEFAULT_SCORING_THRESHOLDS) <
      distance(b.thresholds, DEFAULT_SCORING_THRESHOLDS)
    )
  }

  const defaults = evaluate({ ...DEFAULT_SCORING_THRESHOLDS })
  let best = defaults
  const all: CalibrationCandidate[] = []
  for (const coverageMin of grid.coverageMin) {
    for (const trueMin of grid.trueMin) {
      for (const falseMax of grid.falseMax) {
        const c = evaluate({ coverageMin, trueMin, falseMax })
        all.push(c)
        if (better(c, best)) best = c
      }
    }
  }
  const ties = all.filter(
    (c) => Math.abs(c.macroF1 - best.macroF1) <= eps && Math.abs(c.accuracy - best.accuracy) <= eps,
  ).length
  return { best, defaults, evaluated: all.length, ties }
}
