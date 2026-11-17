import { describe, expect, it } from 'vitest'
import { computeScore } from '../src/services/scoring.ts'
import type { ClaimLabel } from '../src/domain/schemas.ts'

const S: ClaimLabel = 'SUPORTADA'
const C: ClaimLabel = 'CONTRADITA'
const I: ClaimLabel = 'INSUFICIENTE'

const rep = (label: ClaimLabel, n: number): ClaimLabel[] => Array<ClaimLabel>(n).fill(label)

describe('computeScore — fórmulas', () => {
  it('conta rótulos e calcula s e c', () => {
    const r = computeScore([...rep(S, 5), ...rep(C, 1), ...rep(I, 2)])
    expect(r.counts).toEqual({ supported: 5, contradicted: 1, insufficient: 2, total: 8 })
    expect(r.score).toBeCloseTo(4 / 6)
    expect(r.coverage).toBeCloseTo(6 / 8)
  })

  it('lista vazia → score null, cobertura 0, IMPRECISO', () => {
    expect(computeScore([])).toMatchObject({ score: null, coverage: 0, verdict: 'IMPRECISO' })
  })

  it('só INSUFICIENTE → score null, cobertura 0, IMPRECISO', () => {
    expect(computeScore(rep(I, 4))).toMatchObject({
      score: null,
      coverage: 0,
      verdict: 'IMPRECISO',
    })
  })

  it('score fica em [-1, 1] nos extremos', () => {
    expect(computeScore(rep(S, 3)).score).toBe(1)
    expect(computeScore(rep(C, 3)).score).toBe(-1)
  })
})

describe('computeScore — fronteiras com limiares padrão (c ≥ 0.5, s ≥ 0.5, s ≤ -0.3)', () => {
  it('c = 0.5 exato e s = 1 → VERDADEIRO', () => {
    const r = computeScore([S, I])
    expect(r.coverage).toBe(0.5)
    expect(r.verdict).toBe('VERDADEIRO')
  })

  it('c logo abaixo de 0.5 (4/9) e s = 1 → IMPRECISO', () => {
    expect(computeScore([...rep(S, 4), ...rep(I, 5)]).verdict).toBe('IMPRECISO')
  })

  it('c = 0.5 exato e s = -1 → FALSO', () => {
    expect(computeScore([C, I]).verdict).toBe('FALSO')
  })

  it('c logo abaixo de 0.5 (4/9) e s = -1 → IMPRECISO', () => {
    expect(computeScore([...rep(C, 4), ...rep(I, 5)]).verdict).toBe('IMPRECISO')
  })

  it('s = 0.5 exato (3S, 1C) → VERDADEIRO', () => {
    const r = computeScore([...rep(S, 3), C])
    expect(r.score).toBe(0.5)
    expect(r.verdict).toBe('VERDADEIRO')
  })

  it('s logo abaixo de 0.5 (5S, 2C → 3/7) → IMPRECISO', () => {
    expect(computeScore([...rep(S, 5), ...rep(C, 2)]).verdict).toBe('IMPRECISO')
  })

  it('s = -0.3 exato (7S, 13C) → FALSO', () => {
    const r = computeScore([...rep(S, 7), ...rep(C, 13)])
    expect(r.score).toBeCloseTo(-0.3)
    expect(r.verdict).toBe('FALSO')
  })

  it('s logo acima de -0.3 (7S, 12C → -5/19) → IMPRECISO', () => {
    expect(computeScore([...rep(S, 7), ...rep(C, 12)]).verdict).toBe('IMPRECISO')
  })

  it('s = 0 (empate) com cobertura total → IMPRECISO', () => {
    expect(computeScore([S, C]).verdict).toBe('IMPRECISO')
  })
})

describe('computeScore — limiares customizados (calibração)', () => {
  const thresholds = { coverageMin: 0.3, trueMin: 0.8, falseMax: -0.8 }

  it('respeita coverageMin com fronteira sujeita a arredondamento (3/10 = 0.3)', () => {
    expect(computeScore([...rep(S, 3), ...rep(I, 7)], thresholds).verdict).toBe('VERDADEIRO')
  })

  it('respeita trueMin e falseMax', () => {
    // s = (4 - 1) / 5 = 0.6 < 0.8
    expect(computeScore([...rep(S, 4), C], thresholds).verdict).toBe('IMPRECISO')
    // s = (1 - 9) / 10 = -0.8
    expect(computeScore([S, ...rep(C, 9)], thresholds).verdict).toBe('FALSO')
  })
})
