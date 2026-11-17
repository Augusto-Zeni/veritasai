import { describe, expect, it } from 'vitest'
import { DEFAULT_SCORING_THRESHOLDS } from '../src/config.ts'
import type { ClaimLabel } from '../src/domain/schemas.ts'
import { buildExplanation, coverageSentence } from '../src/services/explanation.ts'
import { computeScore } from '../src/services/scoring.ts'

const explain = (labels: ClaimLabel[]) =>
  buildExplanation(computeScore(labels), DEFAULT_SCORING_THRESHOLDS)

describe('buildExplanation', () => {
  it('VERDADEIRO', () => {
    expect(explain(['SUPORTADA', 'SUPORTADA', 'INSUFICIENTE'])).toBe(
      'Das 3 afirmações verificadas, 2 foram confirmadas pelas evidências, 0 foram contraditas e 1 não teve evidências suficientes. ' +
        'Como a maior parte das afirmações verificáveis foi confirmada, a notícia foi classificada como verdadeira.',
    )
  })

  it('FALSO, com singular', () => {
    expect(explain(['CONTRADITA'])).toBe(
      'Da única afirmação verificada, 0 foram confirmadas pelas evidências, 1 foi contradita e 0 não tiveram evidências suficientes. ' +
        'Como a maior parte das afirmações verificáveis foi contradita, a notícia foi classificada como falsa.',
    )
  })

  it('IMPRECISO por cobertura baixa', () => {
    expect(explain(['SUPORTADA', 'INSUFICIENTE', 'INSUFICIENTE'])).toContain(
      'Menos de 50% das afirmações',
    )
  })

  it('IMPRECISO por evidências divididas', () => {
    expect(explain(['SUPORTADA', 'CONTRADITA'])).toContain(
      'confirmam parte das afirmações e contradizem outra parte',
    )
  })

  it('sem afirmações', () => {
    expect(explain([])).toMatch(/^Não foi possível extrair afirmações verificáveis/)
  })
})

describe('coverageSentence', () => {
  it('descreve a cobertura em linguagem simples', () => {
    expect(coverageSentence(computeScore(['SUPORTADA', 'CONTRADITA', 'INSUFICIENTE']))).toBe(
      '2 de 3 afirmações tiveram evidências suficientes para uma conclusão',
    )
    expect(coverageSentence(computeScore(['SUPORTADA']))).toBe(
      '1 de 1 afirmação teve evidências suficientes para uma conclusão',
    )
  })
})
