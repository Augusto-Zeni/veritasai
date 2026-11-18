import { writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import type { ScoringThresholds } from '@veritasai/core'
import { filterSplit, loadDataset, type Split } from './dataset.ts'
import {
  buildCosts,
  buildMetrics,
  errorsMarkdown,
  metricsMarkdown,
  type MetricsReport,
} from './report.ts'
import { readPendingFailures, readResults, readRunConfig, REPO_ROOT, writeJson } from './runs.ts'

export interface WriteReportsOptions {
  /** Limiares alternativos (calibrados): gera metrics.calibrado.* em vez de metrics.*. */
  thresholds?: ScoringThresholds
}

/** Gera metrics.json/.md, costs.json e errors.md a partir do conteúdo da pasta. */
export function writeReports(runDir: string, options: WriteReportsOptions = {}): MetricsReport {
  const config = readRunConfig(runDir)
  const datasetPath = isAbsolute(config.dataset.path)
    ? config.dataset.path
    : resolve(REPO_ROOT, config.dataset.path)
  const dataset = loadDataset(datasetPath)
  const rows = filterSplit(dataset.rows, config.split as Split | 'todos')
  const ids = new Set(rows.map((r) => r.id))

  const records = readResults(runDir).filter((r) => ids.has(r.id))
  const failures = readPendingFailures(runDir, new Set(records.map((r) => r.id)))
  const metrics = buildMetrics(records, {
    variant: config.variant,
    split: config.split,
    datasetItems: rows.length,
    failed: failures.length,
    ...(options.thresholds ? { thresholds: options.thresholds } : {}),
  })

  const suffix = options.thresholds ? '.calibrado' : ''
  writeJson(join(runDir, `metrics${suffix}.json`), metrics)
  writeFileSync(join(runDir, `metrics${suffix}.md`), metricsMarkdown(metrics))
  writeFileSync(
    join(runDir, `errors${suffix}.md`),
    errorsMarkdown(records, new Map(rows.map((r) => [r.id, r])), failures, options.thresholds),
  )
  if (!options.thresholds) writeJson(join(runDir, 'costs.json'), buildCosts(records))
  return metrics
}
