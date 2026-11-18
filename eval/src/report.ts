/**
 * Relatórios de uma execução: métricas (metrics.json/.md), custos (costs.json)
 * e discordâncias para análise qualitativa (errors.md).
 */
import {
  computeScore,
  NEWS_VERDICTS,
  type NewsVerdict,
  type ScoringThresholds,
  type Variant,
} from '@veritasai/core'
import type { DatasetRow } from './dataset.ts'
import {
  classificationMetrics,
  majorityBaseline,
  mean,
  percentile,
  type ClassificationMetrics,
} from './metrics.ts'
import type { FailureRecord, RunRecord } from './runs.ts'

/** Variantes cujo veredito vem do scoring (podem ser recalculadas com outros limiares). */
const SCORED_VARIANTS: ReadonlySet<Variant> = new Set(['full', 'full-no-factcheck-domains'])

/**
 * Veredito do registro. Com `thresholds`, recalcula a partir dos rótulos das afirmações
 * (sem chamar nenhuma API) — usado para aplicar limiares calibrados.
 */
export function predictedVerdict(record: RunRecord, thresholds?: ScoringThresholds): NewsVerdict {
  const { result } = record
  if (!thresholds || !SCORED_VARIANTS.has(result.meta.variant)) return result.verdict
  return computeScore(
    result.claims.map((c) => c.label),
    thresholds,
  ).verdict
}

export interface MetricsReport extends ClassificationMetrics {
  variant: string
  split: string
  /** Notícias do split no dataset. */
  datasetItems: number
  /** Notícias que falharam (não entram nas métricas). */
  failed: number
  thresholds: ScoringThresholds | null
  references: {
    majorityClass: { label: string; accuracy: number }
    uniformRandom: number
    humans: number
    ghadiri2022: number
  }
}

export function buildMetrics(
  records: readonly RunRecord[],
  opts: {
    variant: string
    split: string
    datasetItems: number
    failed: number
    thresholds?: ScoringThresholds
  },
): MetricsReport {
  const pairs = records.map((r) => ({
    expected: r.expected,
    predicted: predictedVerdict(r, opts.thresholds),
  }))
  return {
    variant: opts.variant,
    split: opts.split,
    datasetItems: opts.datasetItems,
    failed: opts.failed,
    thresholds: opts.thresholds ?? null,
    ...classificationMetrics(pairs, NEWS_VERDICTS),
    references: {
      majorityClass: majorityBaseline(records.map((r) => r.expected)),
      uniformRandom: 1 / NEWS_VERDICTS.length,
      humans: 0.6,
      ghadiri2022: 0.7,
    },
  }
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const dec = (x: number) => x.toFixed(3)

export function metricsMarkdown(m: MetricsReport): string {
  const lines = [
    `# Métricas — variante \`${m.variant}\`, split \`${m.split}\``,
    '',
    `- Notícias avaliadas: **${m.n}** de ${m.datasetItems} (${m.failed} com falha, fora das métricas)`,
    `- Acurácia: **${pct(m.accuracy)}**`,
    `- Macro-F1: **${dec(m.macroF1)}**`,
    m.thresholds
      ? `- Limiares: cobertura ≥ ${m.thresholds.coverageMin}, VERDADEIRO s ≥ ${m.thresholds.trueMin}, FALSO s ≤ ${m.thresholds.falseMax}`
      : '- Limiares: os da execução',
    '',
    '## Por classe',
    '',
    '| Classe | Precisão | Revocação | F1 | Suporte |',
    '|---|---|---|---|---|',
    ...NEWS_VERDICTS.map((l) => {
      const c = m.perClass[l]!
      return `| ${l} | ${dec(c.precision)} | ${dec(c.recall)} | ${dec(c.f1)} | ${c.support} |`
    }),
    '',
    '## Matriz de confusão (linhas = gabarito, colunas = sistema)',
    '',
    `| | ${NEWS_VERDICTS.join(' | ')} |`,
    `|---|${NEWS_VERDICTS.map(() => '---').join('|')}|`,
    ...NEWS_VERDICTS.map(
      (e) => `| **${e}** | ${NEWS_VERDICTS.map((p) => m.confusion[e]![p]).join(' | ')} |`,
    ),
    '',
    '## Referências de comparação',
    '',
    '| Referência | Acurácia |',
    '|---|---|',
    `| Este sistema (\`${m.variant}\`) | ${pct(m.accuracy)} |`,
    `| Pessoas julgando veracidade (OCDE, 2024) | ${pct(m.references.humans)} |`,
    `| Ghadiri et al. (2022) | ${pct(m.references.ghadiri2022)} |`,
    `| Sempre a classe majoritária (${m.references.majorityClass.label || '—'}) | ${pct(m.references.majorityClass.accuracy)} |`,
    `| Chute uniforme em 3 classes | ${pct(m.references.uniformRandom)} |`,
    '',
  ]
  return lines.join('\n')
}

export interface CostsReport {
  items: number
  /** Notícias atendidas inteiramente pelo cache de verificações. */
  verificationCacheHits: number
  tokens: { input: number; output: number; meanInputPerItem: number; meanOutputPerItem: number }
  apiCalls: { total: Record<string, number>; meanPerItem: Record<string, number> }
  responseCacheHits: Record<string, number>
  latencyMs: Record<string, { mean: number; p95: number }>
  note: string
}

export function buildCosts(records: readonly RunRecord[]): CostsReport {
  const metas = records.map((r) => r.result.meta)
  const sumRecord = (key: 'apiCalls' | 'cacheHits') => {
    const total: Record<string, number> = {}
    for (const m of metas)
      for (const [k, v] of Object.entries(m[key])) total[k] = (total[k] ?? 0) + v
    return total
  }
  const calls = sumRecord('apiCalls')
  const stages = new Set(metas.flatMap((m) => Object.keys(m.latencyMs)))
  const latencyMs: CostsReport['latencyMs'] = {}
  for (const stage of stages) {
    const values = metas.map((m) => m.latencyMs[stage]).filter((v): v is number => v !== undefined)
    latencyMs[stage] = { mean: Math.round(mean(values)), p95: Math.round(percentile(values, 95)) }
  }
  const input = metas.reduce((s, m) => s + m.tokens.input, 0)
  const output = metas.reduce((s, m) => s + m.tokens.output, 0)
  const n = metas.length || 1
  return {
    items: metas.length,
    verificationCacheHits: metas.filter((m) => m.cacheHit).length,
    tokens: {
      input,
      output,
      meanInputPerItem: Math.round(input / n),
      meanOutputPerItem: Math.round(output / n),
    },
    apiCalls: {
      total: calls,
      meanPerItem: Object.fromEntries(
        Object.entries(calls).map(([k, v]) => [k, Number((v / n).toFixed(2))]),
      ),
    },
    responseCacheHits: sumRecord('cacheHits'),
    latencyMs,
    note:
      'Respostas vindas do cache não geram chamadas nem tokens. Para medir o custo real por notícia, ' +
      'use uma execução feita com o cache vazio (ou só as notícias sem cacheHits).',
  }
}

export function errorsMarkdown(
  records: readonly RunRecord[],
  dataset: ReadonlyMap<string, DatasetRow>,
  failures: readonly FailureRecord[],
  thresholds?: ScoringThresholds,
): string {
  const wrong = records.filter((r) => predictedVerdict(r, thresholds) !== r.expected)
  const lines = [
    '# Discordâncias entre o sistema e o gabarito',
    '',
    `${wrong.length} de ${records.length} notícias. Use esta lista para a análise qualitativa dos erros.`,
    '',
  ]
  for (const r of wrong) {
    const row = dataset.get(r.id)
    const { result } = r
    lines.push(
      `## ${r.id} — ${row?.titulo || result.article.title || r.url}`,
      '',
      `- Gabarito: **${r.expected}** (agência: ${row?.agencia ?? '?'}, rótulo original: "${row?.rotulo_agencia ?? '?'}")`,
      `- Sistema: **${predictedVerdict(r, thresholds)}** (score ${result.score === null ? '—' : result.score.toFixed(2)}, cobertura ${(result.coverage * 100).toFixed(0)}%)`,
      `- Notícia: ${r.url}`,
      ...(row ? [`- Checagem: ${row.url_checagem}`] : []),
      `- Explicação do sistema: ${result.explanation}`,
      '',
      '| Afirmação | Rótulo | Justificativa | Fontes usadas |',
      '|---|---|---|---|',
      ...result.claims.map((c) => {
        const used = c.evidences.filter((e) => c.evidenceIdsUsed.includes(e.id)).map((e) => e.url)
        const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
        return `| ${cell(c.claim.text)} | ${c.label} | ${cell(c.rationale)} | ${used.join('<br>') || '—'} |`
      }),
      '',
    )
  }
  if (failures.length > 0) {
    lines.push(
      '# Notícias com falha (fora das métricas)',
      '',
      '| id | erro | url |',
      '|---|---|---|',
    )
    for (const f of failures)
      lines.push(`| ${f.id} | ${f.code}: ${f.error.replace(/\|/g, '\\|')} | ${f.url} |`)
    lines.push('')
  }
  return lines.join('\n')
}
