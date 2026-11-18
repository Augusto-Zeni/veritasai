/**
 * Executa uma variante do sistema sobre o dataset e grava os artefatos em
 * eval/runs/<timestamp>_<variante>/.
 *
 *   pnpm eval:run -- --variant full --split teste
 *   pnpm eval:run -- --resume eval/runs/2026-11-18T14-30-05_full
 *
 * Opções: --variant, --split (teste | calibracao | todos), --limit N, --ids a,b,c,
 *         --dataset caminho.csv, --thresholds calibration.json, --resume pasta
 *
 * Notícias são processadas uma por vez, em modo estrito: se uma afirmação falhar,
 * a notícia inteira vai para failures.jsonl (e será tentada de novo no --resume).
 * Se a cota diária do LLM acabar, a execução para e mostra o comando para retomar.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import {
  createVerifier,
  loadConfig,
  LlmQuotaError,
  publicConfig,
  PROMPTS_BY_VARIANT,
  promptVersions,
  VARIANTS,
  VeritasError,
  type ScoringThresholds,
  type Variant,
} from '@veritasai/core'
import { fail, parseCliArgs } from '../src/args.ts'
import { filterSplit, loadDataset, SPLITS, type Split } from '../src/dataset.ts'
import {
  appendJsonl,
  CONFIG_FILE,
  DEFAULT_DATASET,
  FAILURES_FILE,
  gitInfo,
  readResults,
  readRunConfig,
  REPO_ROOT,
  RESULTS_FILE,
  RUNS_DIR,
  runDirName,
  writeJson,
  type FailureRecord,
  type RunConfig,
  type RunRecord,
} from '../src/runs.ts'
import { writeReports } from '../src/write-reports.ts'

const { values } = parseCliArgs({
  variant: { type: 'string' },
  split: { type: 'string', default: 'teste' },
  limit: { type: 'string' },
  ids: { type: 'string' },
  dataset: { type: 'string' },
  thresholds: { type: 'string' },
  resume: { type: 'string' },
})

const rel = (p: string) => relative(REPO_ROOT, p) || '.'

// --- Pasta da execução e parâmetros (nova ou retomada) ---
let runDir: string
let previous: RunConfig | undefined
let variant: Variant
let split: Split | 'todos'
let datasetPath: string
let thresholds: ScoringThresholds | undefined

if (values.resume) {
  runDir = resolve(values.resume)
  if (!existsSync(join(runDir, CONFIG_FILE))) fail(`${values.resume} não tem ${CONFIG_FILE}`)
  if (values.variant || values.thresholds || values.dataset) {
    fail('Com --resume, variante, limiares e dataset vêm do config.json da execução')
  }
  previous = readRunConfig(runDir)
  variant = previous.variant
  split = previous.split as Split | 'todos'
  datasetPath = resolve(REPO_ROOT, previous.dataset.path)
  thresholds = previous.config.scoring as ScoringThresholds
} else {
  if (!values.variant || !(VARIANTS as readonly string[]).includes(values.variant)) {
    fail(`--variant deve ser um de: ${VARIANTS.join(', ')}`)
  }
  if (!(['todos', ...SPLITS] as string[]).includes(values.split)) {
    fail(`--split deve ser um de: ${[...SPLITS, 'todos'].join(', ')}`)
  }
  variant = values.variant as Variant
  split = values.split as Split | 'todos'
  datasetPath = resolve(values.dataset ?? DEFAULT_DATASET)
  runDir = join(RUNS_DIR, runDirName(new Date(), variant))
  if (values.thresholds) {
    const file = JSON.parse(readFileSync(resolve(values.thresholds), 'utf8')) as {
      best?: { thresholds?: ScoringThresholds }
    }
    thresholds = file.best?.thresholds
    if (!thresholds)
      fail(`${values.thresholds} não tem best.thresholds (gere com pnpm eval:calibrate)`)
  }
}

const dataset = loadDataset(datasetPath)
for (const w of dataset.warnings) process.stderr.write(`! ${w}\n`)
const baseConfig = loadConfig(process.env, thresholds ? { scoring: thresholds } : {})

const handle = (() => {
  try {
    return createVerifier(baseConfig, variant, {
      onReaderFallback: ({ url, reason }) =>
        process.stderr.write(`    ! Jina falhou em ${url} (${reason})\n`),
    })
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err))
  }
})()

const currentPrompts = promptVersions(PROMPTS_BY_VARIANT[variant]) as Record<string, string>
if (previous) {
  // Retomar só faz sentido com o mesmo sistema; senão os resultados misturariam versões.
  const problems: string[] = []
  if (previous.model !== handle.config.geminiModel)
    problems.push(`modelo ${previous.model} → ${handle.config.geminiModel}`)
  if (JSON.stringify(previous.promptVersions) !== JSON.stringify(currentPrompts))
    problems.push('versões dos prompts mudaram')
  if (previous.dataset.sha256 !== dataset.hash) problems.push('o arquivo do dataset mudou')
  if (problems.length > 0) {
    await handle.close()
    fail(`Não é possível retomar ${rel(runDir)}: ${problems.join('; ')}. Inicie uma nova execução.`)
  }
} else {
  mkdirSync(runDir, { recursive: true })
  const runConfig: RunConfig = {
    variant,
    split,
    dataset: { path: rel(datasetPath), sha256: dataset.hash, items: dataset.rows.length },
    model: handle.config.geminiModel,
    promptVersions: currentPrompts,
    config: publicConfig(handle.config) as unknown as Record<string, unknown>,
    git: gitInfo(),
    node: process.version,
    startedAt: new Date().toISOString(),
    args: { ...values },
  }
  writeJson(join(runDir, CONFIG_FILE), runConfig)
  if (runConfig.git.dirty) {
    process.stderr.write(
      '! Há alterações não commitadas: o commit em config.json não descreve exatamente o código usado.\n',
    )
  }
}

// --- Seleção das notícias ---
// No --resume, vale a seleção (--ids/--limit) da execução original.
const selection = previous ? (previous.args as { ids?: string; limit?: string }) : values
if (previous && (values.ids || values.limit)) {
  fail('Com --resume, --ids e --limit vêm do config.json da execução')
}
let rows = filterSplit(dataset.rows, split)
if (selection.ids) {
  const wanted = new Set(selection.ids.split(',').map((s) => s.trim()))
  rows = rows.filter((r) => wanted.has(r.id))
}
if (selection.limit !== undefined) {
  const limit = Number(selection.limit)
  if (!Number.isInteger(limit) || limit < 0) fail('--limit deve ser um inteiro ≥ 0')
  rows = rows.slice(0, limit)
}

const done = new Set(readResults(runDir).map((r) => r.id))
const pending = rows.filter((r) => !done.has(r.id))
process.stderr.write(
  `\nVariante: ${variant} | split: ${split} | ${rows.length} notícias (${done.size} já feitas, ${pending.length} pendentes)\n` +
    `Pasta: ${rel(runDir)}\n\n`,
)

// --- Execução ---
let stoppedByQuota = false
let ok = 0
let failed = 0
for (const [i, row] of pending.entries()) {
  const prefix = `[${i + 1}/${pending.length}] ${row.id}`
  process.stderr.write(`${prefix} ${row.url}\n`)
  try {
    const result = await handle.verifier.run(row.url, { strict: true })
    const record: RunRecord = {
      id: row.id,
      url: row.url,
      split: row.split,
      expected: row.rotulo_mapeado,
      result,
    }
    appendJsonl(join(runDir, RESULTS_FILE), record)
    ok++
    const hit = result.meta.cacheHit ? ' (cache)' : ''
    const mark = result.verdict === row.rotulo_mapeado ? '✔' : '✘'
    process.stderr.write(
      `    ${mark} sistema: ${result.verdict} | gabarito: ${row.rotulo_mapeado}${hit}\n`,
    )
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    const code = err instanceof VeritasError ? err.code : 'UNKNOWN'
    const failure: FailureRecord = {
      id: row.id,
      url: row.url,
      error,
      code,
      timestamp: new Date().toISOString(),
    }
    appendJsonl(join(runDir, FAILURES_FILE), failure)
    failed++
    process.stderr.write(`    ! falhou (${code}): ${error}\n`)
    if (err instanceof LlmQuotaError && !err.retryable) {
      stoppedByQuota = true
      break
    }
  }
}

await handle.close()

// --- Relatórios ---
const metrics = writeReports(runDir)
process.stderr.write(
  `\nNesta sessão: ${ok} concluídas, ${failed} com falha. Uso do LLM hoje (neste processo): ${handle.limiter.usedToday}.\n` +
    `Acumulado: ${metrics.n} avaliadas | acurácia ${(metrics.accuracy * 100).toFixed(1)}% | macro-F1 ${metrics.macroF1.toFixed(3)}\n` +
    `Relatórios em ${rel(runDir)}/ (metrics.md, costs.json, errors.md)\n`,
)
const finished = new Set(readResults(runDir).map((r) => r.id))
const remaining = rows.filter((r) => !finished.has(r.id)).length
if (remaining > 0) {
  process.stderr.write(
    `\n${stoppedByQuota ? 'Cota diária do LLM esgotada. ' : ''}${remaining} notícia(s) pendente(s). Para continuar:\n` +
      `  pnpm eval:run -- --resume ${rel(runDir)}\n`,
  )
}
