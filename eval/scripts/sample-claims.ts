/**
 * Sorteia afirmações (semente fixa) para rotulação manual — avaliação no nível da afirmação.
 *
 *   pnpm eval:sample-claims -- --run eval/runs/<pasta> --n 100 --seed 42
 *
 * Cria <pasta>/amostra-afirmacoes/ com:
 *   - afirmacoes_para_rotular.csv  → preencher a coluna rotulo_manual (sem ver o rótulo do sistema)
 *   - rotulos_sistema.csv          → NÃO abrir antes de terminar a rotulação
 *   - LEIA-ME.md                   → instruções
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fail, parseCliArgs } from '../src/args.ts'
import { MANUAL_COLUMNS, sampleClaims, SYSTEM_COLUMNS } from '../src/claim-sample.ts'
import { stringifyCsv } from '../src/csv.ts'
import { readResults, readRunConfig, REPO_ROOT } from '../src/runs.ts'

const { values } = parseCliArgs({
  run: { type: 'string' },
  n: { type: 'string', default: '100' },
  seed: { type: 'string', default: '42' },
  force: { type: 'boolean', default: false },
})
if (!values.run) fail('Uso: pnpm eval:sample-claims -- --run eval/runs/<pasta> --n 100 --seed 42')
const runDir = resolve(values.run)
const config = readRunConfig(runDir)
if (config.variant !== 'full' && config.variant !== 'full-no-factcheck-domains') {
  fail(`A variante ${config.variant} não decompõe a notícia em afirmações.`)
}
const n = Number(values.n)
const seed = Number(values.seed)
if (!Number.isInteger(n) || n <= 0 || !Number.isInteger(seed))
  fail('--n e --seed devem ser inteiros')

const outDir = join(runDir, 'amostra-afirmacoes')
if (existsSync(join(outDir, 'afirmacoes_para_rotular.csv')) && !values.force) {
  fail(
    `${relative(REPO_ROOT, outDir)} já existe (pode conter rotulação manual). Use --force para sobrescrever.`,
  )
}
mkdirSync(outDir, { recursive: true })

const sample = sampleClaims(readResults(runDir), n, seed)
writeFileSync(
  join(outDir, 'afirmacoes_para_rotular.csv'),
  stringifyCsv(
    MANUAL_COLUMNS,
    sample.map((s) => s.manual),
  ),
)
writeFileSync(
  join(outDir, 'rotulos_sistema.csv'),
  stringifyCsv(
    SYSTEM_COLUMNS,
    sample.map((s) => s.system),
  ),
)
writeFileSync(
  join(outDir, 'LEIA-ME.md'),
  [
    '# Rotulação manual das afirmações',
    '',
    `Amostra de ${sample.length} afirmações sorteadas com semente ${seed} da execução \`${relative(REPO_ROOT, runDir)}\`.`,
    '',
    '1. Abra **afirmacoes_para_rotular.csv** e preencha a coluna `rotulo_manual` de cada linha com:',
    '   - `SUPORTADA` (ou `S`): as evidências listadas confirmam a afirmação;',
    '   - `CONTRADITA` (ou `C`): as evidências listadas contradizem a afirmação;',
    '   - `INSUFICIENTE` (ou `I`): as evidências não permitem decidir.',
    '2. Julgue **somente com as evidências da coluna `evidencias`** (o mesmo que o sistema recebeu).',
    '   Assim o Kappa mede a etapa de classificação (Verification) isoladamente.',
    '3. **Não abra `rotulos_sistema.csv`** antes de terminar (rotulação cega, evita viés de ancoragem).',
    '4. Use `observacao` para anotar casos difíceis (servem para a análise qualitativa).',
    '5. Depois rode: `pnpm eval:kappa -- --sample ' + relative(REPO_ROOT, outDir) + '`',
    '',
  ].join('\n'),
)
process.stdout.write(
  `${sample.length} afirmações sorteadas em ${relative(REPO_ROOT, outDir)}/ (leia o LEIA-ME.md)\n`,
)
