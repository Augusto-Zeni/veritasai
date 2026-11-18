import { DEFAULT_SCORING_THRESHOLDS } from '@veritasai/core'
import { describe, expect, it } from 'vitest'
import { calibrate } from '../src/calibration.ts'
import {
  buildCosts,
  buildMetrics,
  errorsMarkdown,
  metricsMarkdown,
  predictedVerdict,
} from '../src/report.ts'
import { record } from './fixtures.ts'

describe('predictedVerdict', () => {
  it('sem limiares usa o veredito gravado; com limiares recalcula só as variantes full*', () => {
    // 1 SUPORTADA + 2 INSUFICIENTE: c = 1/3 → IMPRECISO no padrão; com coverageMin 0.3 → VERDADEIRO
    const r = record('N1', 'VERDADEIRO', 'IMPRECISO', ['SUPORTADA', 'INSUFICIENTE', 'INSUFICIENTE'])
    expect(predictedVerdict(r)).toBe('IMPRECISO')
    expect(predictedVerdict(r, { ...DEFAULT_SCORING_THRESHOLDS, coverageMin: 0.3 })).toBe(
      'VERDADEIRO',
    )
    const baseline = record('N2', 'FALSO', 'FALSO', ['CONTRADITA'], 'no-retrieval')
    expect(predictedVerdict(baseline, { coverageMin: 0, trueMin: -1, falseMax: -2 })).toBe('FALSO')
  })
})

describe('buildMetrics / metricsMarkdown', () => {
  it('inclui métricas, matriz e referências de comparação', () => {
    const records = [
      record('N1', 'VERDADEIRO', 'VERDADEIRO'),
      record('N2', 'FALSO', 'FALSO'),
      record('N3', 'FALSO', 'IMPRECISO'),
      record('N4', 'IMPRECISO', 'IMPRECISO'),
    ]
    const m = buildMetrics(records, { variant: 'full', split: 'teste', datasetItems: 5, failed: 1 })
    expect(m).toMatchObject({ n: 4, accuracy: 0.75, failed: 1, datasetItems: 5 })
    expect(m.references.majorityClass).toEqual({ label: 'FALSO', accuracy: 0.5 })
    const md = metricsMarkdown(m)
    expect(md).toContain('Notícias avaliadas: **4** de 5 (1 com falha')
    expect(md).toContain('| **FALSO** | 0 | 1 | 1 |')
    expect(md).toContain('OCDE, 2024')
  })
})

describe('buildCosts', () => {
  it('soma chamadas e tokens; média e p95 de latência por etapa', () => {
    const costs = buildCosts([record('N1', 'FALSO', 'FALSO'), record('N2', 'FALSO', 'FALSO')])
    expect(costs.tokens).toEqual({
      input: 200,
      output: 20,
      meanInputPerItem: 100,
      meanOutputPerItem: 10,
    })
    expect(costs.apiCalls.total).toEqual({ gemini: 6, serper: 4 })
    expect(costs.apiCalls.meanPerItem).toEqual({ gemini: 3, serper: 2 })
    expect(costs.latencyMs.total).toEqual({ mean: 1000, p95: 1000 })
  })
})

describe('errorsMarkdown', () => {
  it('lista só as discordâncias, com afirmações e links, e as falhas', () => {
    const md = errorsMarkdown(
      [record('N1', 'FALSO', 'FALSO'), record('N2', 'FALSO', 'VERDADEIRO', ['SUPORTADA'])],
      new Map(),
      [{ id: 'N3', url: 'https://x.com', error: 'HTTP 403', code: 'SCRAPE', timestamp: '' }],
    )
    expect(md).toContain('1 de 2 notícias')
    expect(md).toContain('## N2')
    expect(md).not.toContain('## N1')
    expect(md).toContain(
      '| Afirmação 1 da notícia N2. | SUPORTADA | Justificativa 1. | https://gov.br/x |',
    )
    expect(md).toContain('| N3 | SCRAPE: HTTP 403 | https://x.com |')
  })
})

describe('calibrate', () => {
  it('encontra limiares que acertam onde o padrão erra e não piora o macro-F1', () => {
    const records = [
      // Verdadeiras com cobertura baixa (1 de 3): o padrão (c ≥ 0.5) diz IMPRECISO
      record('N1', 'VERDADEIRO', 'IMPRECISO', ['SUPORTADA', 'INSUFICIENTE', 'INSUFICIENTE']),
      record('N2', 'VERDADEIRO', 'IMPRECISO', ['SUPORTADA', 'INSUFICIENTE', 'INSUFICIENTE']),
      record('N3', 'FALSO', 'FALSO', ['CONTRADITA', 'CONTRADITA']),
      record('N4', 'IMPRECISO', 'IMPRECISO', ['SUPORTADA', 'CONTRADITA']),
    ]
    const result = calibrate(records)
    expect(result.defaults.accuracy).toBe(0.5)
    expect(result.best.accuracy).toBe(1)
    expect(result.best.thresholds.coverageMin).toBeLessThanOrEqual(0.3)
    expect(result.best.macroF1).toBeGreaterThan(result.defaults.macroF1)
    expect(result.evaluated).toBe(7 * 10 * 10)
  })

  it('sem ganho possível, mantém os limiares padrão (desempate pela proximidade)', () => {
    const records = [
      record('N1', 'FALSO', 'FALSO', ['CONTRADITA']),
      record('N2', 'VERDADEIRO', 'VERDADEIRO', ['SUPORTADA']),
    ]
    expect(calibrate(records).best.thresholds).toEqual(DEFAULT_SCORING_THRESHOLDS)
  })
})
