/**
 * Orquestração do pipeline de verificação:
 *
 *   URL → Scraper → ClaimExtraction → QueryGeneration
 *       → para cada afirmação: Search → Evidence → Verification
 *       → Scoring → Explicação
 *
 * Emite eventos de progresso (consumidos pela CLI e pelo SSE da API) e degrada com
 * elegância: falha numa afirmação vira INSUFICIENTE com o motivo registrado.
 */
import pLimit from 'p-limit'
import type { CacheStore } from './cache/cache-store.ts'
import type { ScoringThresholds } from './config.ts'
import {
  VerificationResultSchema,
  type Article,
  type Claim,
  type ClaimLabel,
  type ClaimResult,
  type RunMeta,
  type VerificationResult,
} from './domain/schemas.ts'
import { stableHash, sha256 } from './utils/hash.ts'
import { normalizeUrl } from './utils/url.ts'
import { diffUsage, type UsageTracker } from './usage.ts'
import type { ClaimExtractionService } from './services/claim-extraction.ts'
import type { EvidenceService } from './services/evidence.ts'
import { buildExplanation } from './services/explanation.ts'
import type { QueryGenerationService } from './services/query-generation.ts'
import type { ProvidedText, ScraperService } from './services/scraper.ts'
import { computeScore } from './services/scoring.ts'
import type { SearchService } from './services/search.ts'
import type { VerificationService } from './services/verification.ts'

export type PipelineStage = 'scrape' | 'claims' | 'queries' | 'evidence' | 'scoring'

export type PipelineEvent =
  | { type: 'stage'; stage: PipelineStage; status: 'start' | 'done' }
  | { type: 'article'; title?: string; domain: string; truncated: boolean }
  | { type: 'claims'; claims: Claim[] }
  | { type: 'claim-done'; claimId: string; label: ClaimLabel; done: number; total: number }
  | { type: 'cache-hit' }

export interface PipelineDeps {
  scraper: ScraperService
  claimExtraction: ClaimExtractionService
  queryGeneration: QueryGenerationService
  search: SearchService
  evidence: EvidenceService
  verification: VerificationService
  tracker: UsageTracker
  /** Cache de verificações inteiras (opcional). */
  cache?: CacheStore
  /** Nome do modelo do LLM (vai para o `meta`). */
  model: string
  promptVersions: Record<string, string>
  /** Config pública (sem chaves), salva no `meta` e usada no hash do cache. */
  publicConfig: Record<string, unknown>
  thresholds: ScoringThresholds
  excludeFactcheckDomains: boolean
  useTrustedDomains: boolean
  /** Afirmações processadas em paralelo (o LLM continua limitado pelo RateLimiter). */
  claimConcurrency?: number
  now?: () => Date
  clock?: () => number
}

export interface RunOptions {
  onEvent?: (event: PipelineEvent) => void
  /** Ignora o cache de verificações (as respostas de LLM/busca continuam cacheadas). */
  force?: boolean
  /**
   * Modo avaliação: erro numa afirmação interrompe a notícia (lança o erro) em vez de
   * virar INSUFICIENTE. Evita que falta de cota contamine as métricas.
   */
  strict?: boolean
  /**
   * Modo avaliação: usa este texto em vez de ler a URL (conteúdo de rede social, que não
   * é extraível). A URL continua identificando a origem (domínio excluído da busca).
   */
  providedText?: ProvidedText
}

/** Qualquer variante do sistema (pipeline completo ou baselines). */
export interface Verifier {
  run(url: string, options?: RunOptions): Promise<VerificationResult>
}

/** Campos da config que não alteram o resultado (ficam fora do hash do cache). */
const OPERATIONAL_KEYS = new Set(['cachePath', 'llmRpm', 'llmRpd'])

/** Chave do cache de verificações: muda se mudar config, prompts ou modelo. */
export function verificationConfigHash(
  deps: Pick<PipelineDeps, 'model' | 'promptVersions' | 'publicConfig'>,
): string {
  const config = Object.fromEntries(
    Object.entries(deps.publicConfig).filter(([k]) => !OPERATIONAL_KEYS.has(k)),
  )
  return stableHash({ model: deps.model, promptVersions: deps.promptVersions, config })
}

export class VerificationPipeline implements Verifier {
  private readonly now: () => Date
  private readonly clock: () => number

  constructor(private readonly deps: PipelineDeps) {
    this.now = deps.now ?? (() => new Date())
    this.clock = deps.clock ?? (() => performance.now())
  }

  async run(rawUrl: string, options: RunOptions = {}): Promise<VerificationResult> {
    const { deps } = this
    const emit = options.onEvent ?? (() => {})
    const url = normalizeUrl(rawUrl)
    // Com texto fornecido, o texto entra na chave: editar o dataset invalida o cache.
    const urlHash = options.providedText
      ? sha256(`${url}\n${sha256(options.providedText.text)}`)
      : sha256(url)
    const configHash = verificationConfigHash(deps)

    if (deps.cache && !options.force) {
      const cached = VerificationResultSchema.safeParse(
        await deps.cache.getVerification(urlHash, configHash),
      )
      if (cached.success) {
        emit({ type: 'cache-hit' })
        return { ...cached.data, meta: { ...cached.data.meta, cacheHit: true } }
      }
    }

    const usageBefore = deps.tracker.snapshot()
    const latencyMs: Record<string, number> = {}
    const warnings: string[] = []
    const started = this.clock()
    const timed = async <T>(stage: string, fn: () => Promise<T>): Promise<T> => {
      const t0 = this.clock()
      try {
        return await fn()
      } finally {
        latencyMs[stage] = (latencyMs[stage] ?? 0) + (this.clock() - t0)
      }
    }
    const stage = async <T>(name: PipelineStage, fn: () => Promise<T>): Promise<T> => {
      emit({ type: 'stage', stage: name, status: 'start' })
      const result = await fn()
      emit({ type: 'stage', stage: name, status: 'done' })
      return result
    }

    // 1. Texto da notícia (falha aqui interrompe: não há o que verificar).
    const scraped = await stage('scrape', () =>
      timed('scrape', () => deps.scraper.scrape(url, options.providedText)),
    )
    const { article } = scraped
    emit({
      type: 'article',
      domain: article.domain,
      truncated: scraped.truncated,
      ...(article.title ? { title: article.title } : {}),
    })
    if (scraped.truncated) {
      warnings.push(`Texto truncado: ${scraped.originalChars} → ${article.text.length} caracteres`)
    }

    // 2. Afirmações (falha aqui também interrompe).
    const claims = await stage('claims', () =>
      timed('claimExtraction', () => deps.claimExtraction.extract(article)),
    )
    emit({ type: 'claims', claims })

    // 3. Consultas (uma chamada para todas; degrada para o texto da afirmação).
    const queries = await stage('queries', () =>
      timed('queryGeneration', () => deps.queryGeneration.generate(claims)),
    )
    if (queries.error)
      warnings.push(`Geração de consultas falhou (${queries.error}); usado o texto das afirmações`)
    else if (queries.fallbackIds.length > 0) {
      warnings.push(
        `Consulta ausente para ${queries.fallbackIds.join(', ')}; usado o texto da afirmação`,
      )
    }

    // 4. Evidências + verificação por afirmação, em paralelo limitado.
    emit({ type: 'stage', stage: 'evidence', status: 'start' })
    const limit = pLimit(deps.claimConcurrency ?? 3)
    let done = 0
    const claimResults = await Promise.all(
      claims.map((claim) =>
        limit(async () => {
          const query = queries.queries.get(claim.id) ?? claim.text
          const result = await this.processClaim(
            claim,
            query,
            article,
            timed,
            warnings,
            options.strict ?? false,
          )
          done++
          emit({
            type: 'claim-done',
            claimId: claim.id,
            label: result.label,
            done,
            total: claims.length,
          })
          return result
        }),
      ),
    )
    emit({ type: 'stage', stage: 'evidence', status: 'done' })

    // 5. Agregação.
    emit({ type: 'stage', stage: 'scoring', status: 'start' })
    const t0 = this.clock()
    const score = computeScore(
      claimResults.map((r) => r.label),
      deps.thresholds,
    )
    const explanation = buildExplanation(score, deps.thresholds)
    latencyMs.scoring = this.clock() - t0
    latencyMs.total = this.clock() - started
    emit({ type: 'stage', stage: 'scoring', status: 'done' })

    const usage = diffUsage(usageBefore, deps.tracker.snapshot())
    const meta: RunMeta = {
      variant: deps.excludeFactcheckDomains ? 'full-no-factcheck-domains' : 'full',
      model: deps.model,
      promptVersions: deps.promptVersions,
      config: deps.publicConfig,
      tokens: usage.tokens,
      latencyMs: Object.fromEntries(Object.entries(latencyMs).map(([k, v]) => [k, Math.round(v)])),
      apiCalls: usage.apiCalls,
      cacheHits: usage.cacheHits,
      scrapeMethod: scraped.method,
      truncated: scraped.truncated,
      trustedDomainsUsed: deps.useTrustedDomains,
      excludedFactcheckDomains: deps.excludeFactcheckDomains,
      cacheHit: false,
      warnings,
      timestamp: this.now().toISOString(),
    }
    const result: VerificationResult = {
      article,
      claims: claimResults,
      score: score.score,
      coverage: score.coverage,
      verdict: score.verdict,
      explanation,
      meta,
    }

    // Só cacheia verificações sem falhas (erros podem ser temporários, como cota).
    if (deps.cache && claimResults.every((r) => r.error === undefined)) {
      await deps.cache.setVerification(urlHash, configHash, result)
    }
    return result
  }

  private async processClaim(
    claim: Claim,
    query: string,
    article: Article,
    timed: <T>(stage: string, fn: () => Promise<T>) => Promise<T>,
    warnings: string[],
    strict: boolean,
  ): Promise<ClaimResult> {
    const { deps } = this
    let evidences: ClaimResult['evidences'] = []
    try {
      const results = await timed('search', () => deps.search.search(query, article.domain))
      const collected = await timed('evidence', () => deps.evidence.collect(claim, results))
      evidences = collected.evidences
      if (collected.failures.length > 0) {
        warnings.push(`${claim.id}: ${collected.failures.length} página(s) não puderam ser lidas`)
      }
      const verdict = await timed('verification', () => deps.verification.verify(claim, evidences))
      return { claim, query, evidences, ...verdict }
    } catch (err) {
      if (strict) throw err
      const message = err instanceof Error ? err.message : String(err)
      warnings.push(`${claim.id}: ${message}`)
      return {
        claim,
        query,
        evidences,
        label: 'INSUFICIENTE',
        rationale: `Não foi possível verificar esta afirmação: ${message}`,
        evidenceIdsUsed: [],
        error: message,
      }
    }
  }
}
