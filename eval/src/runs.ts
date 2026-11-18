import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { NewsVerdictSchema, VariantSchema, VerificationResultSchema } from '@veritasai/core'
import { z } from 'zod'

/** Raiz do repositório (eval/src → ../..). */
export const REPO_ROOT = resolve(import.meta.dirname, '../..')
export const RUNS_DIR = join(REPO_ROOT, 'eval', 'runs')
export const DEFAULT_DATASET = join(REPO_ROOT, 'eval', 'dataset', 'noticias.csv')

export const RESULTS_FILE = 'results.jsonl'
export const FAILURES_FILE = 'failures.jsonl'
export const CONFIG_FILE = 'config.json'

/** Uma linha de results.jsonl: a notícia do dataset + o resultado do sistema. */
export const RunRecordSchema = z.object({
  id: z.string(),
  url: z.string(),
  split: z.string(),
  expected: NewsVerdictSchema,
  result: VerificationResultSchema,
})
export type RunRecord = z.infer<typeof RunRecordSchema>

/** Uma linha de failures.jsonl: notícia que não pôde ser processada nesta tentativa. */
export const FailureRecordSchema = z.object({
  id: z.string(),
  url: z.string(),
  error: z.string(),
  code: z.string(),
  timestamp: z.string(),
})
export type FailureRecord = z.infer<typeof FailureRecordSchema>

export const RunConfigSchema = z.object({
  variant: VariantSchema,
  split: z.string(),
  dataset: z.object({ path: z.string(), sha256: z.string(), items: z.number() }),
  model: z.string(),
  promptVersions: z.record(z.string(), z.string()),
  config: z.record(z.string(), z.unknown()),
  git: z.object({ commit: z.string(), dirty: z.boolean() }),
  node: z.string(),
  startedAt: z.string(),
  args: z.record(z.string(), z.unknown()),
})
export type RunConfig = z.infer<typeof RunConfigSchema>

/** `2026-11-18T14-30-05_full` (sem dois-pontos, válido em qualquer sistema de arquivos). */
export function runDirName(date: Date, variant: string): string {
  return `${date.toISOString().slice(0, 19).replace(/:/g, '-')}_${variant}`
}

export function gitInfo(cwd: string = REPO_ROOT): { commit: string; dirty: boolean } {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
    const status = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' })
    return { commit, dirty: status.trim().length > 0 }
  } catch {
    return { commit: 'desconhecido', dirty: true }
  }
}

function readJsonl<T>(path: string, schema: z.ZodType<T>): T[] {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line, i) => {
      const parsed = schema.safeParse(JSON.parse(line))
      if (!parsed.success)
        throw new Error(`${path}: linha ${i + 1} inválida: ${parsed.error.message}`)
      return parsed.data
    })
}

export function readResults(runDir: string): RunRecord[] {
  return readJsonl(join(runDir, RESULTS_FILE), RunRecordSchema)
}

/** Falhas ainda pendentes: a última falha de cada id que não tem resultado. */
export function readPendingFailures(runDir: string, done: ReadonlySet<string>): FailureRecord[] {
  const latest = new Map<string, FailureRecord>()
  for (const f of readJsonl(join(runDir, FAILURES_FILE), FailureRecordSchema)) latest.set(f.id, f)
  return [...latest.values()].filter((f) => !done.has(f.id))
}

export function readRunConfig(runDir: string): RunConfig {
  return RunConfigSchema.parse(JSON.parse(readFileSync(join(runDir, CONFIG_FILE), 'utf8')))
}

export function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function appendJsonl(path: string, value: unknown): void {
  appendFileSync(path, `${JSON.stringify(value)}\n`)
}
