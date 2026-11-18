/**
 * Monta as variantes do sistema com os clientes reais (Gemini, Serper, Jina/Readability)
 * e o cache SQLite, a partir da config. Usado pela CLI, pela API e pela avaliação.
 */
import { NoDecompositionVerifier, NoRetrievalVerifier } from './baselines.ts'
import type { CacheStore } from './cache/cache-store.ts'
import { SqliteCacheStore } from './cache/sqlite-cache.ts'
import { GeminiClient } from './clients/gemini.ts'
import { JinaReader } from './clients/jina.ts'
import { CachedLlmClient } from './clients/llm.ts'
import { ReadabilityReader } from './clients/readability.ts'
import { FallbackReader } from './clients/reader.ts'
import { SerperClient } from './clients/serper.ts'
import { FACTCHECK_DOMAINS, TRUSTED_DOMAINS, publicConfig, type Config } from './config.ts'
import type { Variant } from './domain/schemas.ts'
import { ConfigError } from './errors.ts'
import { VerificationPipeline, type Verifier } from './pipeline.ts'
import { PROMPTS_BY_VARIANT, promptVersions } from './prompts/index.ts'
import { ClaimExtractionService } from './services/claim-extraction.ts'
import { EvidenceService } from './services/evidence.ts'
import { QueryGenerationService } from './services/query-generation.ts'
import { ScraperService } from './services/scraper.ts'
import { SearchService } from './services/search.ts'
import { VerificationService } from './services/verification.ts'
import { RateLimiter } from './utils/rate-limiter.ts'
import { UsageTracker } from './usage.ts'

export interface CreatePipelineOptions {
  /** Cache a usar; padrão: SQLite em `config.cachePath`. */
  cache?: CacheStore
  tracker?: UsageTracker
  onReaderFallback?: (info: { url: string; reason: string }) => void
}

export interface VerifierHandle {
  verifier: Verifier
  /** Config efetivamente usada (a variante pode sobrescrever flags). */
  config: Config
  tracker: UsageTracker
  limiter: RateLimiter
  close(): Promise<void>
}

export interface PipelineHandle extends VerifierHandle {
  pipeline: VerificationPipeline
}

/** Ajustes de config impostos pela variante. */
export function configForVariant(config: Config, variant: Variant): Config {
  if (variant === 'full') return { ...config, excludeFactcheckDomains: false }
  if (variant === 'full-no-factcheck-domains') return { ...config, excludeFactcheckDomains: true }
  return config
}

/** Cria o verificador da variante pedida. */
export function createVerifier(
  baseConfig: Config,
  variant: Variant,
  options: CreatePipelineOptions = {},
): VerifierHandle {
  const config = configForVariant(baseConfig, variant)
  const tracker = options.tracker ?? new UsageTracker()
  const limiter = new RateLimiter({ rpm: config.llmRpm, rpd: config.llmRpd })

  const gemini = new GeminiClient({
    model: config.geminiModel,
    apiKey: config.geminiApiKey,
    limiter,
    tracker,
  })
  const needsSearch = variant !== 'no-retrieval'
  // Valida as chaves antes de abrir o banco (erro de config não deixa o SQLite aberto).
  if (needsSearch && !config.serperApiKey) {
    throw new ConfigError('SERPER_API_KEY não definido no .env')
  }
  const cache = options.cache ?? new SqliteCacheStore(config.cachePath)
  const llm = new CachedLlmClient(gemini, cache, tracker)
  const reader = new FallbackReader({
    primary: new JinaReader({ apiKey: config.jinaApiKey, cache, tracker }),
    fallback: new ReadabilityReader({ cache, tracker }),
    minChars: config.minArticleChars,
    ...(options.onReaderFallback ? { onFallback: options.onReaderFallback } : {}),
  })
  const scraper = new ScraperService(reader, config)
  const common = {
    tracker,
    model: config.geminiModel,
    promptVersions: promptVersions(PROMPTS_BY_VARIANT[variant]),
    publicConfig: publicConfig(config) as unknown as Record<string, unknown>,
    thresholds: config.scoring,
  }
  const close = () => cache.close()

  if (variant === 'no-retrieval') {
    const verifier = new NoRetrievalVerifier({ ...common, scraper, llm })
    return { verifier, config, tracker, limiter, close }
  }

  const search = new SearchService(
    new SerperClient({ apiKey: config.serperApiKey, cache, tracker }),
    { ...config, factcheckDomains: FACTCHECK_DOMAINS, trustedDomains: TRUSTED_DOMAINS },
  )
  const evidence = new EvidenceService(reader, config)
  const queryGeneration = new QueryGenerationService(llm)

  if (variant === 'no-decomposition') {
    const verifier = new NoDecompositionVerifier({
      ...common,
      scraper,
      llm,
      queryGeneration,
      search,
      evidence,
      excludeFactcheckDomains: config.excludeFactcheckDomains,
      useTrustedDomains: config.useTrustedDomains,
    })
    return { verifier, config, tracker, limiter, close }
  }

  const pipeline = new VerificationPipeline({
    ...common,
    scraper,
    claimExtraction: new ClaimExtractionService(llm, config),
    queryGeneration,
    search,
    evidence,
    verification: new VerificationService(llm),
    cache,
    excludeFactcheckDomains: config.excludeFactcheckDomains,
    useTrustedDomains: config.useTrustedDomains,
  })
  return { verifier: pipeline, config, tracker, limiter, close }
}

/**
 * Pipeline completo (uso normal: CLI e API). Respeita `EXCLUDE_FACTCHECK_DOMAINS` da config.
 */
export function createPipeline(
  config: Config,
  options: CreatePipelineOptions = {},
): PipelineHandle {
  const variant: Variant = config.excludeFactcheckDomains ? 'full-no-factcheck-domains' : 'full'
  const handle = createVerifier(config, variant, options)
  return { ...handle, pipeline: handle.verifier as VerificationPipeline }
}
