import { describe, expect, it } from 'vitest'
import {
  classificationMetrics,
  cohensKappa,
  interpretKappa,
  majorityBaseline,
  percentile,
} from '../src/metrics.ts'

const L = ['A', 'B', 'C']
const pairs = (spec: Array<[string, string, number]>) =>
  spec.flatMap(([expected, predicted, n]) =>
    Array.from({ length: n }, () => ({ expected, predicted })),
  )

describe('classificationMetrics', () => {
  it('calcula matriz, acurácia, P/R/F1 e macro-F1', () => {
    // A: 3 certos, 1 previsto como B; B: 2 certos; C: 1 certo, 1 previsto como A
    const m = classificationMetrics(
      pairs([
        ['A', 'A', 3],
        ['A', 'B', 1],
        ['B', 'B', 2],
        ['C', 'C', 1],
        ['C', 'A', 1],
      ]),
      L,
    )
    expect(m.n).toBe(8)
    expect(m.accuracy).toBe(6 / 8)
    expect(m.confusion).toEqual({
      A: { A: 3, B: 1, C: 0 },
      B: { A: 0, B: 2, C: 0 },
      C: { A: 1, B: 0, C: 1 },
    })
    expect(m.perClass.A).toEqual({ precision: 3 / 4, recall: 3 / 4, f1: 3 / 4, support: 4 })
    expect(m.perClass.B!.precision).toBeCloseTo(2 / 3)
    expect(m.perClass.B!.recall).toBe(1)
    expect(m.perClass.C).toMatchObject({ precision: 1, recall: 0.5, support: 2 })
    expect(m.macroF1).toBeCloseTo((0.75 + 0.8 + 2 / 3) / 3)
  })

  it('classe nunca prevista tem precisão 0 (sem divisão por zero)', () => {
    const m = classificationMetrics(
      pairs([
        ['A', 'A', 2],
        ['C', 'A', 1],
      ]),
      L,
    )
    expect(m.perClass.C).toEqual({ precision: 0, recall: 0, f1: 0, support: 1 })
    expect(m.perClass.B!.support).toBe(0)
  })

  it('rejeita rótulo fora da lista', () => {
    expect(() => classificationMetrics([{ expected: 'A', predicted: 'Z' }], L)).toThrow(
      /fora da lista/,
    )
  })
})

describe('cohensKappa', () => {
  it('reproduz o exemplo clássico (κ = 0,4)', () => {
    // 50 itens: sim/sim 20, sim/não 5, não/sim 10, não/não 15
    const p = pairs([
      ['sim', 'sim', 20],
      ['sim', 'não', 5],
      ['não', 'sim', 10],
      ['não', 'não', 15],
    ])
    expect(cohensKappa(p, ['sim', 'não'])).toBeCloseTo(0.4)
  })

  it('concordância perfeita = 1; casos degenerados', () => {
    expect(
      cohensKappa(
        pairs([
          ['A', 'A', 3],
          ['B', 'B', 2],
        ]),
        L,
      ),
    ).toBe(1)
    expect(cohensKappa(pairs([['A', 'A', 3]]), L)).toBe(1)
    expect(cohensKappa([], L)).toBe(0)
  })

  it('interpretação de Landis e Koch', () => {
    expect(interpretKappa(-0.1)).toBe('pior que o acaso')
    expect(interpretKappa(0.4)).toBe('razoável')
    expect(interpretKappa(0.65)).toBe('substancial')
    expect(interpretKappa(0.9)).toBe('quase perfeita')
  })
})

describe('percentile e majorityBaseline', () => {
  it('p95 por nearest-rank', () => {
    const v = Array.from({ length: 20 }, (_, i) => i + 1)
    expect(percentile(v, 95)).toBe(19)
    expect(percentile(v, 100)).toBe(20)
    expect(percentile([5], 95)).toBe(5)
    expect(percentile([], 95)).toBe(0)
  })

  it('classe majoritária', () => {
    expect(majorityBaseline(['A', 'B', 'B', 'C'])).toEqual({ label: 'B', accuracy: 0.5 })
  })
})
