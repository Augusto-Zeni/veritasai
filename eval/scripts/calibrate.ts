/**
 * Calibra os limiares do scoring no split de CALIBRAÇÃO (busca em grade, maximiza macro-F1).
 * Usa os rótulos de afirmação já gravados; não chama nenhuma API.
 *
 *   pnpm eval:calibrate -- --run eval/runs/<pasta da execução no split calibracao>
 *
 * Grava calibration.json/.md na pasta. Depois:
 *   pnpm eval:metrics -- eval/runs/<pasta no split teste> --thresholds eval/runs/<calibração>/calibration.json
 */
import { writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fail, parseCliArgs } from '../src/args.ts'
import { calibrate, DEFAULT_GRID } from '../src/calibration.ts'
import { readResults, readRunConfig, REPO_ROOT, writeJson } from '../src/runs.ts'

const { values } = parseCliArgs({ run: { type: 'string' }, split: { type: 'string' } })
if (!values.run) fail('Uso: pnpm eval:calibrate -- --run eval/runs/<pasta>')
const runDir = resolve(values.run)
const config = readRunConfig(runDir)

if (config.split !== 'calibracao') {
  fail(
    `A execução ${relative(REPO_ROOT, runDir)} é do split "${config.split}". ` +
      'Calibrar fora do split de calibração invalida o resultado (o teste deixa de ser independente).',
  )
}
if (config.variant !== 'full' && config.variant !== 'full-no-factcheck-domains') {
  fail(`A variante ${config.variant} não usa os limiares do scoring; não há o que calibrar.`)
}

const records = readResults(runDir)
if (records.length === 0) fail('A execução não tem resultados.')
const result = calibrate(records)
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

writeJson(join(runDir, 'calibration.json'), {
  variant: config.variant,
  split: config.split,
  items: records.length,
  grid: DEFAULT_GRID,
  ...result,
})
const md = [
  `# Calibração dos limiares — \`${config.variant}\` (${records.length} notícias de calibração)`,
  '',
  '| | Cobertura mín. | s mín. (VERDADEIRO) | s máx. (FALSO) | Macro-F1 | Acurácia |',
  '|---|---|---|---|---|---|',
  `| Padrão | ${result.defaults.thresholds.coverageMin} | ${result.defaults.thresholds.trueMin} | ${result.defaults.thresholds.falseMax} | ${result.defaults.macroF1.toFixed(3)} | ${pct(result.defaults.accuracy)} |`,
  `| **Calibrado** | ${result.best.thresholds.coverageMin} | ${result.best.thresholds.trueMin} | ${result.best.thresholds.falseMax} | ${result.best.macroF1.toFixed(3)} | ${pct(result.best.accuracy)} |`,
  '',
  `- Combinações avaliadas: ${result.evaluated}; empatadas com a melhor: ${result.ties}.`,
  '- Critério: maior macro-F1 → maior acurácia → mais próximo dos limiares padrão.',
  result.ties > 10
    ? '- ⚠ Muitos empates: há pouca informação no split de calibração para distinguir os limiares (risco de sobreajuste).'
    : '',
  '',
].join('\n')
writeFileSync(join(runDir, 'calibration.md'), md)
process.stdout.write(md)
process.stdout.write(
  `\nPara aplicar no split de teste (sem chamar APIs):\n  pnpm eval:metrics -- eval/runs/<pasta-teste> --thresholds ${relative(REPO_ROOT, join(runDir, 'calibration.json'))}\n` +
    '\n⚠ Mudar limiares torna os resultados anteriores não comparáveis: relate qual conjunto de limiares foi usado.\n',
)
