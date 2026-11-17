/**
 * Monta o pipeline com os clientes reais (Gemini, Serper, Jina/Readability)
 * e o cache SQLite, a partir da config. Usado pela CLI, pela API e pela avaliação.
 */
import type { CacheStore } from './cache/cache-store.ts'
import { SqliteCacheStore } from './cache/sqlite-cache.ts'
import { GeminiClient } from './clients/gemini.ts'
import { JinaReader } from './clients/jina.ts'
import { CachedLlmClient } from './clients/llm.ts'
import { ReadabilityReader } from './clients/readability.ts'
import { FallbackReader } from './clients/reader.ts'
import { SerperClient } from './clients/serper.ts'
import { FACTCHECK_DOMAINS, TRUSTED_DOMAINS, publicConfig, type Config } from './config.ts'
import { ConfigError } from './errors.ts'
import { VerificationPipeline } from './pipeline.ts'
import { promptVersions } from './prompts/index.ts'
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

export interface PipelineHandle {
  pipeline: VerificationPipeline
  tracker: UsageTracker
  limiter: RateLimiter
  close(): Promise<void>
}

export function createPipeline(
  config: Config,
  options: CreatePipelineOptions = {},
): PipelineHandle {
  const tracker = options.tracker ?? new UsageTracker()
  const limiter = new RateLimiter({ rpm: config.llmRpm, rpd: config.llmRpd })

  const gemini = new GeminiClient({
    model: config.geminiModel,
    apiKey: config.geminiApiKey,
    limiter,
    tracker,
  })
  // Valida as chaves antes de abrir o banco (erro de config não deixa o SQLite aberto).
  if (!config.serperApiKey) throw new ConfigError('SERPER_API_KEY não definido no .env')
  const cache = options.cache ?? new SqliteCacheStore(config.cachePath)
  const llm = new CachedLlmClient(gemini, cache, tracker)
  const search = new SerperClient({ apiKey: config.serperApiKey, cache, tracker })
  const reader = new FallbackReader({
    primary: new JinaReader({ apiKey: config.jinaApiKey, cache, tracker }),
    fallback: new ReadabilityReader({ cache, tracker }),
    minChars: config.minArticleChars,
    ...(options.onReaderFallback ? { onFallback: options.onReaderFallback } : {}),
  })

  const pipeline = new VerificationPipeline({
    scraper: new ScraperService(reader, config),
    claimExtraction: new ClaimExtractionService(llm, config),
    queryGeneration: new QueryGenerationService(llm),
    search: new SearchService(search, {
      ...config,
      factcheckDomains: FACTCHECK_DOMAINS,
      trustedDomains: TRUSTED_DOMAINS,
    }),
    evidence: new EvidenceService(reader, config),
    verification: new VerificationService(llm),
    tracker,
    cache,
    model: config.geminiModel,
    promptVersions: promptVersions(),
    publicConfig: publicConfig(config) as unknown as Record<string, unknown>,
    thresholds: config.scoring,
    excludeFactcheckDomains: config.excludeFactcheckDomains,
    useTrustedDomains: config.useTrustedDomains,
  })

  return { pipeline, tracker, limiter, close: () => cache.close() }
}
