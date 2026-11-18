/**
 * (Re)gera os relatórios de uma execução, sem chamar nenhuma API.
 *
 *   pnpm eval:metrics -- eval/runs/<pasta>
 *   pnpm eval:metrics -- eval/runs/<pasta> --thresholds eval/runs/<calibracao>/calibration.json
 *
 * Com --thresholds, recalcula os vereditos das variantes `full*` com os limiares calibrados
 * e grava metrics.calibrado.md/.json e errors.calibrado.md.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ScoringThresholds } from '@veritasai/core'
import { fail, parseCliArgs } from '../src/args.ts'
import { metricsMarkdown } from '../src/report.ts'
import { readRunConfig } from '../src/runs.ts'
import { writeReports } from '../src/write-reports.ts'

const { values, positionals } = parseCliArgs({ thresholds: { type: 'string' } })
const dir = positionals[0]
if (!dir) fail('Uso: pnpm eval:metrics -- eval/runs/<pasta> [--thresholds calibration.json]')
const runDir = resolve(dir)

let thresholds: ScoringThresholds | undefined
if (values.thresholds) {
  const file = JSON.parse(readFileSync(resolve(values.thresholds), 'utf8')) as {
    best?: { thresholds?: ScoringThresholds }
    split?: string
  }
  thresholds = file.best?.thresholds
  if (!thresholds) fail(`${values.thresholds} não tem best.thresholds`)
  if (readRunConfig(runDir).split === 'calibracao') {
    process.stderr.write(
      '! Aplicando limiares calibrados ao próprio split de calibração: não reporte como resultado final.\n',
    )
  }
}

const metrics = writeReports(runDir, thresholds ? { thresholds } : {})
process.stdout.write(metricsMarkdown(metrics))
