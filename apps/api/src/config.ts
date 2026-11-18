import { z } from 'zod'

const positiveInt = (def: number) => z.coerce.number().int().positive().default(def)

const ApiEnvSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  /** Verificações executadas ao mesmo tempo (a cota do LLM é o gargalo; 1 mantém o consumo por notícia exato). */
  API_MAX_CONCURRENT_JOBS: positiveInt(1),
  /** Verificações aguardando na fila; acima disso a API responde 503. */
  API_MAX_QUEUE: positiveInt(20),
  /** Tempo que uma verificação terminada fica disponível em memória. */
  API_JOB_TTL_MS: positiveInt(15 * 60 * 1000),
})

export interface ApiConfig {
  port: number
  host: string
  maxConcurrentJobs: number
  maxQueue: number
  jobTtlMs: number
}

export function loadApiConfig(env: Record<string, string | undefined> = process.env): ApiConfig {
  const clean = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v.trim() !== ''),
  )
  const e = ApiEnvSchema.parse(clean)
  return {
    port: e.PORT,
    host: e.HOST,
    maxConcurrentJobs: e.API_MAX_CONCURRENT_JOBS,
    maxQueue: e.API_MAX_QUEUE,
    jobTtlMs: e.API_JOB_TTL_MS,
  }
}
