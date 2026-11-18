/**
 * Modelo de domínio. Os tipos são inferidos dos schemas Zod,
 * para que a mesma definição sirva para validação (saídas de LLM, cache, results.jsonl)
 * e para tipagem.
 */
import { z } from 'zod'

export const CLAIM_LABELS = ['SUPORTADA', 'CONTRADITA', 'INSUFICIENTE'] as const
export const NEWS_VERDICTS = ['VERDADEIRO', 'FALSO', 'IMPRECISO'] as const

export const ClaimLabelSchema = z.enum(CLAIM_LABELS)
export const NewsVerdictSchema = z.enum(NEWS_VERDICTS)

export type ClaimLabel = z.infer<typeof ClaimLabelSchema>
export type NewsVerdict = z.infer<typeof NewsVerdictSchema>

/** Variantes do sistema avaliadas no estudo de ablação. */
export const VARIANTS = [
  'full',
  'no-decomposition',
  'no-retrieval',
  'full-no-factcheck-domains',
] as const
export const VariantSchema = z.enum(VARIANTS)
export type Variant = z.infer<typeof VariantSchema>

export const ScrapeMethodSchema = z.enum(['jina', 'readability'])
export type ScrapeMethod = z.infer<typeof ScrapeMethodSchema>

export const ArticleSchema = z.object({
  url: z.string().url(),
  domain: z.string().min(1),
  title: z.string().optional(),
  publishedAt: z.string().optional(),
  text: z.string(),
})
export type Article = z.infer<typeof ArticleSchema>

export const ClaimSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  sourceSentence: z.string().optional(),
})
export type Claim = z.infer<typeof ClaimSchema>

export const EvidenceSchema = z.object({
  /** Identificador dentro da afirmação (E1, E2...), citado pelo LLM na verificação. */
  id: z.string().min(1),
  url: z.string().url(),
  domain: z.string().min(1),
  title: z.string(),
  snippet: z.string().min(1),
  publishedAt: z.string().optional(),
})
export type Evidence = z.infer<typeof EvidenceSchema>

export const ClaimResultSchema = z.object({
  claim: ClaimSchema,
  query: z.string(),
  evidences: z.array(EvidenceSchema),
  label: ClaimLabelSchema,
  /** Justificativa curta do LLM (ou motivo da degradação, em caso de erro). */
  rationale: z.string(),
  /** Ids das evidências que o LLM disse ter usado para decidir o rótulo. */
  evidenceIdsUsed: z.array(z.string()),
  /** Preenchido quando a afirmação virou INSUFICIENTE por falha (ex.: cota esgotada). */
  error: z.string().optional(),
})
export type ClaimResult = z.infer<typeof ClaimResultSchema>

export const TokenUsageSchema = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
})
export type TokenUsage = z.infer<typeof TokenUsageSchema>

export const RunMetaSchema = z.object({
  variant: VariantSchema,
  model: z.string(),
  promptVersions: z.record(z.string(), z.string()),
  /** Config pública (sem chaves de API) usada nesta execução. */
  config: z.record(z.string(), z.unknown()),
  tokens: TokenUsageSchema,
  /** Latência em ms por etapa (scrape, claimExtraction, search, evidence, verification, scoring). */
  latencyMs: z.record(z.string(), z.number().nonnegative()),
  /** Contagem de chamadas por API externa (gemini, serper, jina). */
  apiCalls: z.record(z.string(), z.number().int().nonnegative()),
  /** Respostas reaproveitadas do cache por API (não geraram chamada nem tokens). */
  cacheHits: z.record(z.string(), z.number().int().nonnegative()),
  scrapeMethod: ScrapeMethodSchema,
  truncated: z.boolean(),
  trustedDomainsUsed: z.boolean(),
  excludedFactcheckDomains: z.boolean(),
  /** A verificação inteira veio do cache (nenhuma etapa foi executada). */
  cacheHit: z.boolean(),
  /** Degradações ocorridas (consulta substituída, página ilegível, afirmação com erro). */
  warnings: z.array(z.string()),
  timestamp: z.string().datetime(),
})
export type RunMeta = z.infer<typeof RunMetaSchema>

export const VerificationResultSchema = z.object({
  article: ArticleSchema,
  claims: z.array(ClaimResultSchema),
  /** s = (n_s - n_c) / (n_s + n_c), em [-1, 1]; null se n_s + n_c = 0. */
  score: z.number().min(-1).max(1).nullable(),
  /** c = (n_s + n_c) / N, em [0, 1]. */
  coverage: z.number().min(0).max(1),
  verdict: NewsVerdictSchema,
  explanation: z.string(),
  meta: RunMetaSchema,
})
export type VerificationResult = z.infer<typeof VerificationResultSchema>
