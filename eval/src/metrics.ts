/**
 * Métricas de classificação (funções puras): matriz de confusão, acurácia,
 * precisão/revocação/F1 por classe, macro-F1, Kappa de Cohen e percentis.
 */

export type ConfusionMatrix = Record<string, Record<string, number>>

export interface ClassMetrics {
  precision: number
  recall: number
  f1: number
  /** Quantidade de exemplos reais desta classe. */
  support: number
}

export interface ClassificationMetrics {
  n: number
  accuracy: number
  macroF1: number
  perClass: Record<string, ClassMetrics>
  /** confusion[esperado][previsto] */
  confusion: ConfusionMatrix
}

export interface Pair {
  expected: string
  predicted: string
}

export function confusionMatrix(
  pairs: readonly Pair[],
  labels: readonly string[],
): ConfusionMatrix {
  const m: ConfusionMatrix = Object.fromEntries(
    labels.map((e) => [e, Object.fromEntries(labels.map((p) => [p, 0]))]),
  )
  for (const { expected, predicted } of pairs) {
    if (!(expected in m) || !(predicted in m[expected]!)) {
      throw new Error(`Rótulo fora da lista: ${expected} → ${predicted}`)
    }
    m[expected]![predicted]!++
  }
  return m
}

const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b)

export function classificationMetrics(
  pairs: readonly Pair[],
  labels: readonly string[],
): ClassificationMetrics {
  const confusion = confusionMatrix(pairs, labels)
  const n = pairs.length
  const correct = labels.reduce((sum, l) => sum + confusion[l]![l]!, 0)

  const perClass: Record<string, ClassMetrics> = {}
  for (const label of labels) {
    const tp = confusion[label]![label]!
    const predictedAs = labels.reduce((sum, e) => sum + confusion[e]![label]!, 0)
    const support = labels.reduce((sum, p) => sum + confusion[label]![p]!, 0)
    const precision = safeDiv(tp, predictedAs)
    const recall = safeDiv(tp, support)
    perClass[label] = {
      precision,
      recall,
      f1: safeDiv(2 * precision * recall, precision + recall),
      support,
    }
  }
  // Macro-F1 sobre todas as classes da lista (classe sem exemplos conta como F1 = 0).
  const macroF1 = labels.reduce((sum, l) => sum + perClass[l]!.f1, 0) / labels.length
  return { n, accuracy: safeDiv(correct, n), macroF1, perClass, confusion }
}

/**
 * Kappa de Cohen: concordância entre dois avaliadores descontando o acaso.
 * κ = (p_o - p_e) / (1 - p_e). Se p_e = 1 (todos iguais numa só classe), devolve 1.
 */
export function cohensKappa(pairs: readonly Pair[], labels: readonly string[]): number {
  const n = pairs.length
  if (n === 0) return 0
  const confusion = confusionMatrix(pairs, labels)
  const po = labels.reduce((sum, l) => sum + confusion[l]![l]!, 0) / n
  let pe = 0
  for (const l of labels) {
    const rowTotal = labels.reduce((sum, p) => sum + confusion[l]![p]!, 0)
    const colTotal = labels.reduce((sum, e) => sum + confusion[e]![l]!, 0)
    pe += (rowTotal / n) * (colTotal / n)
  }
  return pe === 1 ? 1 : (po - pe) / (1 - pe)
}

/** Interpretação de Landis e Koch (1977). */
export function interpretKappa(kappa: number): string {
  if (kappa < 0) return 'pior que o acaso'
  if (kappa <= 0.2) return 'leve'
  if (kappa <= 0.4) return 'razoável'
  if (kappa <= 0.6) return 'moderada'
  if (kappa <= 0.8) return 'substancial'
  return 'quase perfeita'
}

/** Percentil pelo método nearest-rank (p em [0, 100]). */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]!
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
}

/** Distribuição de classes e acurácia de referência (chutar sempre a classe majoritária). */
export function majorityBaseline(expected: readonly string[]): { label: string; accuracy: number } {
  const counts = new Map<string, number>()
  for (const e of expected) counts.set(e, (counts.get(e) ?? 0) + 1)
  let label = ''
  let max = 0
  for (const [l, c] of counts) {
    if (c > max) {
      label = l
      max = c
    }
  }
  return { label, accuracy: safeDiv(max, expected.length) }
}
