/**
 * Configuração central do pipeline: limiares, listas de domínios e flags.
 * Valores vêm do ambiente (`.env`) e são validados com Zod; limiares de
 * scoring ficam aqui (não hardcoded nos serviços) e vão para o `meta` de cada resultado.
 */
import { z } from 'zod'

export const VERSION = '0.0.0'

export interface ScoringThresholds {
  /** Cobertura mínima c = (n_s + n_c) / N para emitir VERDADEIRO ou FALSO. */
  coverageMin: number
  /** Score mínimo s para VERDADEIRO (inclusivo). */
  trueMin: number
  /** Score máximo s para FALSO (inclusivo). */
  falseMax: number
}

export const DEFAULT_SCORING_THRESHOLDS: Readonly<ScoringThresholds> = Object.freeze({
  coverageMin: 0.5,
  trueMin: 0.5,
  falseMax: -0.3,
})

/**
 * Domínios de agências de checagem. Com `EXCLUDE_FACTCHECK_DOMAINS=true`,
 * a busca os exclui para evitar vazamento de gabarito na avaliação.
 */
export const FACTCHECK_DOMAINS: readonly string[] = Object.freeze([
  'lupa.uol.com.br',
  'piaui.folha.uol.com.br',
  'aosfatos.org',
  'estadao.com.br/estadao-verifica',
  'noticias.uol.com.br/confere',
  'checamos.afp.com',
  'projetocomprova.com.br',
  'g1.globo.com/fato-ou-fake',
  'boatos.org',
  'e-farsas.com',
])

/**
 * Domínios priorizados quando `useTrustedDomains` estiver ativo (opcional).
 * Lista inicial; o uso é registrado no `meta`.
 */
export const TRUSTED_DOMAINS: readonly string[] = Object.freeze([
  'gov.br',
  'ibge.gov.br',
  'agenciabrasil.ebc.com.br',
  'who.int',
  'fiocruz.br',
])

const booleanFromEnv = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1')

const positiveInt = (def: number) => z.coerce.number().int().positive().default(def)

const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default(''),
  SERPER_API_KEY: z.string().default(''),
  JINA_API_KEY: z.string().default(''),
  LLM_RPM: positiveInt(5),
  LLM_RPD: positiveInt(100),
  MAX_ARTICLE_CHARS: positiveInt(20000),
  MAX_CLAIMS: positiveInt(10),
  SEARCH_TOP_K: positiveInt(5),
  EVIDENCE_PAGES: positiveInt(3),
  EXCLUDE_FACTCHECK_DOMAINS: booleanFromEnv,
  CACHE_PATH: z.string().min(1).default('./data/cache.sqlite'),
})

export interface Config {
  geminiApiKey: string
  geminiModel: string
  serperApiKey: string
  jinaApiKey: string
  llmRpm: number
  llmRpd: number
  maxArticleChars: number
  maxClaims: number
  searchTopK: number
  evidencePages: number
  /** Máximo de trechos selecionados por página de evidência. */
  snippetsPerPage: number
  /** Abaixo disso, o texto do Jina é considerado falho e tenta-se o Readability. */
  minArticleChars: number
  excludeFactcheckDomains: boolean
  useTrustedDomains: boolean
  cachePath: string
  scoring: ScoringThresholds
}

/** Variáveis de ambiente vazias contam como ausentes (usam o padrão). */
function dropEmpty(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined && v.trim() !== '') out[k] = v.trim()
  }
  return out
}

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
  overrides: Partial<Config> = {},
): Config {
  const e = EnvSchema.parse(dropEmpty(env))
  return {
    geminiApiKey: e.GEMINI_API_KEY,
    geminiModel: e.GEMINI_MODEL,
    serperApiKey: e.SERPER_API_KEY,
    jinaApiKey: e.JINA_API_KEY,
    llmRpm: e.LLM_RPM,
    llmRpd: e.LLM_RPD,
    maxArticleChars: e.MAX_ARTICLE_CHARS,
    maxClaims: e.MAX_CLAIMS,
    searchTopK: e.SEARCH_TOP_K,
    evidencePages: e.EVIDENCE_PAGES,
    snippetsPerPage: 3,
    minArticleChars: 500,
    excludeFactcheckDomains: e.EXCLUDE_FACTCHECK_DOMAINS,
    useTrustedDomains: false,
    cachePath: e.CACHE_PATH,
    scoring: { ...DEFAULT_SCORING_THRESHOLDS },
    ...overrides,
  }
}

/** Versão da config sem segredos, para salvar em `meta` e em `eval/runs/<...>/config.json`. */
export function publicConfig(
  config: Config,
): Omit<Config, 'geminiApiKey' | 'serperApiKey' | 'jinaApiKey'> {
  const { geminiApiKey: _g, serperApiKey: _s, jinaApiKey: _j, ...rest } = config
  return rest
}
