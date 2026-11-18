import { describe, expect, it } from 'vitest'
import {
  countLabels,
  coverageText,
  formatDuration,
  scoreText,
  thresholdsOf,
  validateUrlInput,
} from '../src/lib/format.ts'
import { matchRoute, paths } from '../src/lib/router.ts'

describe('coverageText', () => {
  it.each([
    [[], 'Nenhuma afirmação verificável foi encontrada'],
    [['SUPORTADA'], 'A única afirmação teve evidências'],
    [['INSUFICIENTE'], 'A única afirmação não teve evidências suficientes'],
    [['SUPORTADA', 'INSUFICIENTE'], '1 de 2 afirmações teve evidências'],
    [
      ['SUPORTADA', 'CONTRADITA', 'SUPORTADA', 'INSUFICIENTE'],
      '3 de 4 afirmações tiveram evidências',
    ],
  ] as const)('%j → %s', (labels, text) => {
    expect(coverageText(countLabels(labels))).toBe(text)
  })
})

describe('scoreText', () => {
  it('descreve o equilíbrio em linguagem simples', () => {
    expect(scoreText(null, countLabels(['INSUFICIENTE']))).toContain('Nenhuma')
    expect(scoreText(1, countLabels(['SUPORTADA']))).toBe(
      'As evidências mais confirmam do que contradizem (1 confirmada, 0 contraditas)',
    )
    expect(scoreText(-1 / 3, countLabels(['SUPORTADA', 'CONTRADITA', 'CONTRADITA']))).toContain(
      'mais contradizem',
    )
    expect(scoreText(0, countLabels(['SUPORTADA', 'CONTRADITA']))).toContain('divididas')
  })
})

describe('thresholdsOf', () => {
  const meta = (config: Record<string, unknown>) =>
    ({ config }) as unknown as Parameters<typeof thresholdsOf>[0]
  it('lê os limiares do meta.config.scoring', () => {
    expect(
      thresholdsOf(meta({ scoring: { coverageMin: 0.5, trueMin: 0.5, falseMax: -0.3 } })),
    ).toEqual({ coverageMin: 0.5, trueMin: 0.5, falseMax: -0.3 })
  })
  it('null se ausentes ou inválidos', () => {
    expect(thresholdsOf(meta({}))).toBeNull()
    expect(thresholdsOf(meta({ scoring: { coverageMin: '0.5' } }))).toBeNull()
  })
})

describe('validateUrlInput', () => {
  it('aceita links e completa https://', () => {
    expect(validateUrlInput(' https://g1.globo.com/x ')).toEqual({
      ok: true,
      url: 'https://g1.globo.com/x',
    })
    expect(validateUrlInput('www.exemplo.com.br/noticia')).toEqual({
      ok: true,
      url: 'https://www.exemplo.com.br/noticia',
    })
  })
  it.each([
    '',
    '   ',
    'texto qualquer',
    'ftp://exemplo.com.br',
    'javascript:alert(1)',
    'localhost',
  ])('recusa %j', (v) => {
    expect(validateUrlInput(v).ok).toBe(false)
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '0 s'],
    [42_400, '42 s'],
    [125_000, '2 min 05 s'],
  ])('%d ms → %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text)
  })
})

describe('matchRoute', () => {
  it('reconhece as rotas', () => {
    expect(matchRoute('/')).toEqual({ name: 'home' })
    expect(matchRoute('/sobre/')).toEqual({ name: 'about' })
    expect(matchRoute(paths.verification('ab c'))).toEqual({ name: 'verification', id: 'ab c' })
    expect(matchRoute('/verificacao/')).toEqual({ name: 'not-found' })
    expect(matchRoute('/qualquer')).toEqual({ name: 'not-found' })
  })
})
