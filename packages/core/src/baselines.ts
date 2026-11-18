/**
 * Baselines do estudo de ablação (testam a hipótese do TCC):
 *
 * - `no-decomposition`: notícia inteira → 1 consulta → 1 busca → evidências → 1 veredito.
 *   Mede o efeito de decompor em afirmações atômicas.
 * - `no-retrieval`: o LLM julga a notícia só com o conhecimento interno, sem busca.
 *   Mede o ganho da recuperação de evidências (e o risco de alucinação).
 *
 * Ambas produzem um `VerificationResult` com uma única "afirmação" que representa
 * a notícia inteira, para que as métricas e os relatórios tratem todas as variantes igual.
 */
import { z } from 'zod'
import { generateJson, type LlmClient } from './clients/llm.ts'
import type { ScoringThresholds } from './config.ts'
import {
  NewsVerdictSchema,
  type Article,
  type Claim,
  type ClaimLabel,
  type Evidence,
  type NewsVerdict,
  type RunMeta,
  type Variant,
  type VerificationResult,
} from './domain/schemas.ts'
import type { PipelineEvent, RunOptions, Verifier } from './pipeline.ts'
import { loadPrompt, renderPrompt } from './prompts/loader.ts'
import type { EvidenceService } from './services/evidence.ts'
import type { QueryGenerationService } from './services/query-generation.ts'
import type { ScraperService, ScrapeOutput } from './services/scraper.ts'
import { computeScore } from './services/scoring.ts'
import type { SearchService } from './services/search.ts'
import { formatEvidences } from './services/verification.ts'
import { diffUsage, type UsageTracker } from './usage.ts'

export const ArticleVerdictOutputSchema = z.object({
  verdict: NewsVerdictSchema,
  rationale: z.string(),
  evidenceIdsUsed: z.array(z.string()).default([]),
})

/** Rótulo equivalente da "afirmação única" (mantém score/cobertura coerentes com o veredito). */
const VERDICT_TO_LABEL: Record<NewsVerdict, ClaimLabel> = {
  VERDADEIRO: 'SUPORTADA',
  FALSO: 'CONTRADITA',
  IMPRECISO: 'INSUFICIENTE',
}

/** Id da pseudo-afirmação que representa a notícia inteira nas baselines. */
export const ARTICLE_CLAIM_ID = 'artigo'

export interface BaselineDeps {
  scraper: ScraperService
  llm: LlmClient
  tracker: UsageTracker
  model: string
  promptVersions: Record<string, string>
  publicConfig: Record<string, unknown>
  thresholds: ScoringThresholds
  now?: () => Date
  clock?: () => number
}

export interface NoDecompositionDeps extends BaselineDeps {
  queryGeneration: QueryGenerationService
  search: SearchService
  evidence: EvidenceService
  excludeFactcheckDomains: boolean
  useTrustedDomains: boolean
}

/** Texto que representa a notícia para gerar a consulta e ranquear evidências. */
export function articleClaim(article: Article): Claim {
  const lead = article.text.slice(0, 400).replace(/\s+/g, ' ').trim()
  return { id: ARTICLE_CLAIM_ID, text: article.title ? `${article.title}. ${lead}` : lead }
}

abstract class BaselineVerifier implements Verifier {
  protected abstract readonly variant: Variant
  protected readonly now: () => Date
  protected readonly clock: () => number

  constructor(protected readonly base: BaselineDeps) {
    this.now = base.now ?? (() => new Date())
    this.clock = base.clock ?? (() => performance.now())
  }

  async run(url: string, options: RunOptions = {}): Promise<VerificationResult> {
    const emit = options.onEvent ?? ((_e: PipelineEvent) => {})
    const before = this.base.tracker.snapshot()
    const latencyMs: Record<string, number> = {}
    const started = this.clock()
    const timed = async <T>(stage: string, fn: () => Promise<T>): Promise<T> => {
      const t0 = this.clock()
      try {
        return await fn()
      } finally {
        latencyMs[stage] = (latencyMs[stage] ?? 0) + (this.clock() - t0)
      }
    }

    emit({ type: 'stage', stage: 'scrape', status: 'start' })
    const scraped = await timed('scrape', () => this.base.scraper.scrape(url, options.providedText))
    emit({ type: 'stage', stage: 'scrape', status: 'done' })

    const judged = await this.judge(scraped, timed, emit)

    const label = VERDICT_TO_LABEL[judged.verdict]
    const score = computeScore([label], this.base.thresholds)
    latencyMs.total = this.clock() - started
    const usage = diffUsage(before, this.base.tracker.snapshot())
    const warnings: string[] = []
    if (scraped.truncated) {
      warnings.push(
        `Texto truncado: ${scraped.originalChars} → ${scraped.article.text.length} caracteres`,
      )
    }

    const meta: RunMeta = {
      variant: this.variant,
      model: this.base.model,
      promptVersions: this.base.promptVersions,
      config: this.base.publicConfig,
      tokens: usage.tokens,
      latencyMs: Object.fromEntries(Object.entries(latencyMs).map(([k, v]) => [k, Math.round(v)])),
      apiCalls: usage.apiCalls,
      cacheHits: usage.cacheHits,
      scrapeMethod: scraped.method,
      truncated: scraped.truncated,
      trustedDomainsUsed: judged.trustedDomainsUsed,
      excludedFactcheckDomains: judged.excludedFactcheckDomains,
      cacheHit: false,
      warnings: [...warnings, ...judged.warnings],
      timestamp: this.now().toISOString(),
    }
    return {
      article: scraped.article,
      claims: [
        {
          claim: articleClaim(scraped.article),
          query: judged.query,
          evidences: judged.evidences,
          label,
          rationale: judged.rationale,
          evidenceIdsUsed: judged.evidenceIdsUsed,
        },
      ],
      score: score.score,
      coverage: score.coverage,
      // O veredito é o do LLM (equivale ao do scoring pela tabela VERDICT_TO_LABEL).
      verdict: judged.verdict,
      explanation: judged.rationale,
      meta,
    }
  }

  protected abstract judge(
    scraped: ScrapeOutput,
    timed: <T>(stage: string, fn: () => Promise<T>) => Promise<T>,
    emit: (event: PipelineEvent) => void,
  ): Promise<{
    verdict: NewsVerdict
    rationale: string
    query: string
    evidences: Evidence[]
    evidenceIdsUsed: string[]
    warnings: string[]
    excludedFactcheckDomains: boolean
    trustedDomainsUsed: boolean
  }>
}

/** Notícia inteira → 1 consulta → evidências → 1 veredito. */
export class NoDecompositionVerifier extends BaselineVerifier {
  static readonly PROMPT_ID = 'article-verification'
  protected readonly variant = 'no-decomposition'

  constructor(private readonly deps: NoDecompositionDeps) {
    super(deps)
  }

  protected async judge(
    scraped: ScrapeOutput,
    timed: <T>(stage: string, fn: () => Promise<T>) => Promise<T>,
    emit: (event: PipelineEvent) => void,
  ) {
    const { article } = scraped
    const claim = articleClaim(article)
    const warnings: string[] = []

    emit({ type: 'stage', stage: 'queries', status: 'start' })
    const generated = await timed('queryGeneration', () =>
      this.deps.queryGeneration.generate([{ id: claim.id, text: article.title ?? claim.text }]),
    )
    const query = generated.queries.get(claim.id) ?? claim.text
    if (generated.error) warnings.push(`Geração de consulta falhou (${generated.error})`)
    emit({ type: 'stage', stage: 'queries', status: 'done' })

    emit({ type: 'stage', stage: 'evidence', status: 'start' })
    const results = await timed('search', () => this.deps.search.search(query, article.domain))
    const collected = await timed('evidence', () => this.deps.evidence.collect(claim, results))
    if (collected.failures.length > 0) {
      warnings.push(`${collected.failures.length} página(s) não puderam ser lidas`)
    }
    const evidences = collected.evidences

    let verdict: NewsVerdict = 'IMPRECISO'
    let rationale = 'Nenhuma evidência relevante foi encontrada para a notícia.'
    let evidenceIdsUsed: string[] = []
    if (evidences.length > 0) {
      const prompt = renderPrompt(loadPrompt(NoDecompositionVerifier.PROMPT_ID), {
        title: article.title ?? '(sem título)',
        text: article.text,
        evidences: formatEvidences(evidences),
      })
      const { data } = await timed('verification', () =>
        generateJson(this.deps.llm, { ...prompt, temperature: 0 }, ArticleVerdictOutputSchema),
      )
      const valid = new Set(evidences.map((e) => e.id))
      verdict = data.verdict
      rationale = data.rationale.trim()
      evidenceIdsUsed = [
        ...new Set(data.evidenceIdsUsed.map((id) => id.trim().toUpperCase())),
      ].filter((id) => valid.has(id))
    }
    emit({ type: 'stage', stage: 'evidence', status: 'done' })

    return {
      verdict,
      rationale,
      query,
      evidences,
      evidenceIdsUsed,
      warnings,
      excludedFactcheckDomains: this.deps.excludeFactcheckDomains,
      trustedDomainsUsed: this.deps.useTrustedDomains,
    }
  }
}

/** O LLM julga a notícia só com o conhecimento interno. */
export class NoRetrievalVerifier extends BaselineVerifier {
  static readonly PROMPT_ID = 'no-retrieval'
  protected readonly variant = 'no-retrieval'

  protected async judge(
    scraped: ScrapeOutput,
    timed: <T>(stage: string, fn: () => Promise<T>) => Promise<T>,
    emit: (event: PipelineEvent) => void,
  ) {
    const { article } = scraped
    emit({ type: 'stage', stage: 'claims', status: 'start' })
    const prompt = renderPrompt(loadPrompt(NoRetrievalVerifier.PROMPT_ID), {
      title: article.title ?? '(sem título)',
      publishedAt: article.publishedAt ?? '(não informada)',
      text: article.text,
    })
    const { data } = await timed('verification', () =>
      generateJson(
        this.base.llm,
        { ...prompt, temperature: 0 },
        ArticleVerdictOutputSchema.omit({ evidenceIdsUsed: true }),
      ),
    )
    emit({ type: 'stage', stage: 'claims', status: 'done' })
    return {
      verdict: data.verdict,
      rationale: data.rationale.trim(),
      query: '',
      evidences: [],
      evidenceIdsUsed: [],
      warnings: [],
      excludedFactcheckDomains: false,
      trustedDomainsUsed: false,
    }
  }
}
