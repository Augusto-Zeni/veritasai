import { describe, expect, it } from 'vitest'
import { NoDecompositionVerifier, NoRetrievalVerifier, articleClaim } from '../src/baselines.ts'
import type { GenerateOptions, LlmClient, LlmRequest, LlmResponse } from '../src/clients/llm.ts'
import {
  DEFAULT_SCORING_THRESHOLDS,
  FACTCHECK_DOMAINS,
  TRUSTED_DOMAINS,
  loadConfig,
} from '../src/config.ts'
import { VerificationResultSchema } from '../src/domain/schemas.ts'
import { LlmQuotaError } from '../src/errors.ts'
import { configForVariant } from '../src/factory.ts'
import { PROMPTS_BY_VARIANT, promptVersions } from '../src/prompts/index.ts'
import { EvidenceService } from '../src/services/evidence.ts'
import { QueryGenerationService } from '../src/services/query-generation.ts'
import { ScraperService } from '../src/services/scraper.ts'
import { SearchService } from '../src/services/search.ts'
import { UsageTracker } from '../src/usage.ts'
import { FakeReader, FakeSearch, searchResult } from './fakes.ts'
import { fixtureJson } from './helpers.ts'

const ARTICLE_URL = 'https://noticias.exemplo.com.br/saude/vacina-dengue'
const jina = fixtureJson('jina/artigo.json') as { data: { content: string; title: string } }

class ScriptedLlm implements LlmClient {
  readonly model = 'fake-model'
  readonly requests: LlmRequest[] = []
  constructor(private readonly handler: (req: LlmRequest) => string | Error) {}
  async generate(request: LlmRequest, _o?: GenerateOptions): Promise<LlmResponse> {
    this.requests.push(request)
    const out = this.handler(request)
    if (out instanceof Error) throw out
    return { text: out, model: this.model, usage: { input: 1, output: 1 }, cached: false }
  }
}

function setup(handler: (req: LlmRequest) => string | Error) {
  const llm = new ScriptedLlm(handler)
  const reader = new FakeReader({
    [ARTICLE_URL]: {
      url: ARTICLE_URL,
      method: 'jina',
      title: jina.data.title,
      text: jina.data.content,
    },
    'https://www.gov.br/saude/nota': {
      url: 'https://www.gov.br/saude/nota',
      method: 'jina',
      text: jina.data.content,
    },
  })
  const searchClient = new FakeSearch([
    searchResult(ARTICLE_URL),
    searchResult('https://www.gov.br/saude/nota'),
  ])
  const base = {
    scraper: new ScraperService(reader, { maxArticleChars: 20000 }),
    llm,
    tracker: new UsageTracker(),
    model: 'fake-model',
    promptVersions: { 'article-verification': '1' },
    publicConfig: {},
    thresholds: DEFAULT_SCORING_THRESHOLDS,
    now: () => new Date('2026-11-18T12:00:00Z'),
  }
  const noDecomposition = new NoDecompositionVerifier({
    ...base,
    queryGeneration: new QueryGenerationService(llm),
    search: new SearchService(searchClient, {
      searchTopK: 5,
      excludeFactcheckDomains: false,
      factcheckDomains: FACTCHECK_DOMAINS,
      useTrustedDomains: false,
      trustedDomains: TRUSTED_DOMAINS,
    }),
    evidence: new EvidenceService(reader, {
      evidencePages: 3,
      snippetsPerPage: 3,
      maxArticleChars: 20000,
    }),
    excludeFactcheckDomains: false,
    useTrustedDomains: false,
  })
  const noRetrieval = new NoRetrievalVerifier(base)
  return { llm, searchClient, noDecomposition, noRetrieval }
}

describe('NoDecompositionVerifier', () => {
  it('faz 1 consulta, 1 busca e 1 veredito para a notícia inteira', async () => {
    const { llm, searchClient, noDecomposition } = setup((req) =>
      req.promptId === 'query-generation'
        ? '{"queries":[{"id":"artigo","query":"vacinação dengue 16 estados"}]}'
        : '{"verdict":"FALSO","rationale":"E1 contradiz.","evidenceIdsUsed":["E1","E99"]}',
    )
    const result = await noDecomposition.run(ARTICLE_URL)

    expect(VerificationResultSchema.safeParse(result).success).toBe(true)
    expect(llm.requests.map((r) => r.promptId)).toEqual([
      'query-generation',
      'article-verification',
    ])
    expect(searchClient.calls).toHaveLength(1)
    expect(llm.requests[1]!.prompt).toContain(jina.data.content.slice(0, 50))
    expect(result).toMatchObject({
      verdict: 'FALSO',
      score: -1,
      coverage: 1,
      explanation: 'E1 contradiz.',
    })
    expect(result.meta.variant).toBe('no-decomposition')
    expect(result.claims).toHaveLength(1)
    expect(result.claims[0]).toMatchObject({
      claim: { id: 'artigo' },
      query: 'vacinação dengue 16 estados',
      label: 'CONTRADITA',
      evidenceIdsUsed: ['E1'],
    })
    expect(result.claims[0]!.evidences.every((e) => e.domain === 'gov.br')).toBe(true)
  })

  it('sem evidências → IMPRECISO sem chamar o verificador', async () => {
    const { llm, noDecomposition, searchClient } = setup(() => '{"queries":[]}')
    searchClient.search = async () => []
    const result = await noDecomposition.run(ARTICLE_URL)
    expect(result.verdict).toBe('IMPRECISO')
    expect(llm.requests.map((r) => r.promptId)).toEqual(['query-generation'])
  })
})

describe('NoRetrievalVerifier', () => {
  it('julga só com o conhecimento do LLM, sem busca', async () => {
    const { llm, searchClient, noRetrieval } = setup(
      () => '{"verdict":"VERDADEIRO","rationale":"Fato conhecido."}',
    )
    const result = await noRetrieval.run(ARTICLE_URL)
    expect(llm.requests.map((r) => r.promptId)).toEqual(['no-retrieval'])
    expect(searchClient.calls).toHaveLength(0)
    expect(result).toMatchObject({ verdict: 'VERDADEIRO', score: 1, coverage: 1 })
    expect(result.meta.variant).toBe('no-retrieval')
    expect(result.claims[0]!.evidences).toEqual([])
  })

  it('erro do LLM é propagado (não vira resultado)', async () => {
    const { noRetrieval } = setup(() => new LlmQuotaError('cota'))
    await expect(noRetrieval.run(ARTICLE_URL)).rejects.toBeInstanceOf(LlmQuotaError)
  })
})

describe('articleClaim', () => {
  it('usa título + início do texto', () => {
    const c = articleClaim({
      url: 'https://x.com',
      domain: 'x.com',
      title: 'Título',
      text: 'Texto  da\nnotícia.',
    })
    expect(c).toEqual({ id: 'artigo', text: 'Título. Texto da notícia.' })
  })
})

describe('variantes', () => {
  it('configForVariant fixa a exclusão das agências conforme a variante', () => {
    const on = loadConfig({ EXCLUDE_FACTCHECK_DOMAINS: 'true' })
    const off = loadConfig({})
    expect(configForVariant(on, 'full').excludeFactcheckDomains).toBe(false)
    expect(configForVariant(off, 'full-no-factcheck-domains').excludeFactcheckDomains).toBe(true)
    expect(configForVariant(on, 'no-decomposition').excludeFactcheckDomains).toBe(true)
  })

  it('cada variante registra só os prompts que usa', () => {
    expect(Object.keys(promptVersions(PROMPTS_BY_VARIANT.full))).toEqual([
      'claim-extraction',
      'query-generation',
      'verification',
    ])
    expect(Object.keys(promptVersions(PROMPTS_BY_VARIANT['no-retrieval']))).toEqual([
      'no-retrieval',
    ])
  })
})
