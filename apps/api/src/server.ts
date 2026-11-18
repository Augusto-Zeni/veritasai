import { isAbsolute, resolve } from 'node:path'
import { ConfigError, createPipeline, loadConfig, type PipelineHandle } from '@veritasai/core'
import { buildApp } from './app.ts'
import { loadApiConfig } from './config.ts'

/** Raiz do repositório (apps/api/src → ../../..): CACHE_PATH relativo é resolvido a partir dela. */
const REPO_ROOT = resolve(import.meta.dirname, '../../..')

const apiConfig = loadApiConfig()
const config = loadConfig()
if (!isAbsolute(config.cachePath)) config.cachePath = resolve(REPO_ROOT, config.cachePath)

let handle: PipelineHandle | null = null
let unavailableReason = ''
try {
  handle = createPipeline(config)
} catch (err) {
  if (!(err instanceof ConfigError)) throw err
  unavailableReason = err.message
}

const app = buildApp({
  verifier: handle?.pipeline ?? null,
  unavailableReason,
  maxConcurrentJobs: apiConfig.maxConcurrentJobs,
  maxQueue: apiConfig.maxQueue,
  jobTtlMs: apiConfig.jobTtlMs,
})
app.addHook('onClose', async () => handle?.close())

if (!handle) {
  app.log.warn(`Verificação desativada: ${unavailableReason}. Só /health vai funcionar.`)
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0))
  })
}

try {
  await app.listen({ port: apiConfig.port, host: apiConfig.host })
} catch (err) {
  app.log.error(err)
  await handle?.close()
  process.exit(1)
}
