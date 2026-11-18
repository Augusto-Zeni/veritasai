/**
 * Concordância entre o sistema e a rotulação manual das afirmações (acurácia e Kappa de Cohen).
 *
 *   pnpm eval:kappa -- --sample eval/runs/<pasta>/amostra-afirmacoes
 *
 * Grava kappa.json e kappa.md na pasta da amostra.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { CLAIM_LABELS } from '@veritasai/core'
import { fail, parseCliArgs } from '../src/args.ts'
import { normalizeManualLabel } from '../src/claim-sample.ts'
import { parseCsvObjects } from '../src/csv.ts'
import { classificationMetrics, cohensKappa, interpretKappa } from '../src/metrics.ts'
import { writeJson } from '../src/runs.ts'

const { values } = parseCliArgs({ sample: { type: 'string' } })
if (!values.sample) fail('Uso: pnpm eval:kappa -- --sample eval/runs/<pasta>/amostra-afirmacoes')
const dir = resolve(values.sample)

const manual = parseCsvObjects(readFileSync(join(dir, 'afirmacoes_para_rotular.csv'), 'utf8'))
const system = new Map(
  parseCsvObjects(readFileSync(join(dir, 'rotulos_sistema.csv'), 'utf8')).map((r) => [
    r.amostra_id!,
    r,
  ]),
)

const pairs: Array<{ expected: string; predicted: string }> = []
let unlabeled = 0
const errors: string[] = []
for (const row of manual) {
  let label
  try {
    label = normalizeManualLabel(row.rotulo_manual ?? '')
  } catch (err) {
    errors.push(`${row.amostra_id}: ${(err as Error).message}`)
    continue
  }
  if (!label) {
    unlabeled++
    continue
  }
  const sys = system.get(row.amostra_id!)
  if (!sys) {
    errors.push(`${row.amostra_id}: não encontrado em rotulos_sistema.csv`)
    continue
  }
  pairs.push({ expected: label, predicted: sys.rotulo_sistema! })
}
if (errors.length > 0) fail(`Corrija a rotulação:\n- ${errors.join('\n- ')}`)
if (pairs.length === 0) fail('Nenhuma afirmação rotulada ainda.')

const metrics = classificationMetrics(pairs, CLAIM_LABELS)
const kappa = cohensKappa(pairs, CLAIM_LABELS)
writeJson(join(dir, 'kappa.json'), {
  ...metrics,
  unlabeled,
  kappa,
  interpretation: interpretKappa(kappa),
})

const md = [
  '# Concordância sistema × rotulação manual (nível da afirmação)',
  '',
  `- Afirmações comparadas: **${pairs.length}**${unlabeled > 0 ? ` (${unlabeled} ainda sem rótulo manual)` : ''}`,
  `- Acurácia: **${(metrics.accuracy * 100).toFixed(1)}%**`,
  `- Kappa de Cohen: **${kappa.toFixed(3)}** (concordância ${interpretKappa(kappa)}, Landis e Koch, 1977)`,
  `- Macro-F1: ${metrics.macroF1.toFixed(3)}`,
  '',
  '## Matriz de confusão (linhas = manual, colunas = sistema)',
  '',
  `| | ${CLAIM_LABELS.join(' | ')} |`,
  `|---|${CLAIM_LABELS.map(() => '---').join('|')}|`,
  ...CLAIM_LABELS.map(
    (e) => `| **${e}** | ${CLAIM_LABELS.map((p) => metrics.confusion[e]![p]).join(' | ')} |`,
  ),
  '',
].join('\n')
writeFileSync(join(dir, 'kappa.md'), md)
process.stdout.write(md)
