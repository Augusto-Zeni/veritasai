import { describe, expect, it } from 'vitest'
import { MemoryCacheStore } from '../src/cache/memory-cache.ts'
import type { GenerateOptions, LlmClient, LlmRequest, LlmResponse } from '../src/clients/llm.ts'
import type { ReadResult } from '../src/clients/reader.ts'
import { DEFAULT_SCORING_THRESHOLDS, FACTCHECK_DOMAINS, TRUSTED_DOMAINS } from '../src/config.ts'
import { VerificationResultSchema, type ClaimLabel } from '../src/domain/schemas.ts'
import { LlmQuotaError, ScrapeError } from '../src/errors.ts'
import {
  VerificationPipeline,
  verificationConfigHash,
  type PipelineDeps,
  type PipelineEvent,
} from '../src/pipeline.ts'
import { ClaimExtractionService } from '../src/services/claim-extraction.ts'
import { EvidenceService } from '../src/services/evidence.ts'
import { QueryGenerationService } from '../src/services/query-generation.ts'
import { ScraperService } from '../src/services/scraper.ts'
import { SearchService } from '../src/services/search.ts'
import { VerificationService } from '../src/services/verification.ts'
import { UsageTracker } from '../src/usage.ts'
import { FakeReader, FakeSearch, searchResult } from './fakes.ts'
import { fixture, fixtureJson } from './helpers.ts'

const ARTICLE_URL = 'https://noticias.exemplo.com.br/saude/vacina-dengue'
const jina = fixtureJson('jina/artigo.json') as { data: { content: string; title: string } }

/** LLM falso que responde conforme o prompt (as verificações rodam em paralelo). */
class ScriptedLlm implements LlmClient {
  readonly model = 'fake-model'
  readonly requests: LlmRequest[] = []
  constructor(private readonly handler: (req: LlmRequest) => string | Error) {}
  async generate(request: LlmRequest, _o?: GenerateOptions): Promise<LlmResponse> {
    this.requests.push(request)
    const out = this.handler(request)
    if (out instanceof Error) throw out
    return { text: out, model: this.model, usage: { input: 100, output: 10 }, cached: false }
  }
}

/** Rótulo por trecho da afirmação; afirmações não listadas → INSUFICIENTE. */
const LABELS: Array<[string, ClaimLabel | Error]> = [
  ['16 estados', 'SUPORTADA'],
  ['1,2 milhão', 'SUPORTADA'],
  ['Takeda.', 'SUPORTADA'],
  ['10 a 14 anos', 'CONTRADITA'],
]

function scriptedLlm(labels = LABELS): ScriptedLlm {
  return new ScriptedLlm((req) => {
    if (req.promptId === 'claim-extraction') return fixture('llm/claim-extraction.json')
    if (req.promptId === 'query-generation') return fixture('llm/query-generation.json')
    const claimLine = req.prompt.split('\n')[0]!
    const match = labels.find(([key]) => claimLine.includes(key))
    const label = match?.[1] ?? 'INSUFICIENTE'
    if (label instanceof Error) return label
    return JSON.stringify({ label, rationale: 'Decidido com base em E1.', evidenceIdsUsed: ['E1'] })
  })
}

function makeDeps(llm: LlmClient, overrides: Partial<PipelineDeps> = {}) {
  const pages: Record<string, ReadResult | Error> = {
    [ARTICLE_URL]: {
      url: ARTICLE_URL,
      method: 'jina',
      title: jina.data.title,
      text: jina.data.content,
    },
    'https://www.gov.br/saude/nota': {
      url: 'https://www.gov.br/saude/nota',
      method: 'jina',
      title: 'Nota do Ministério',
      text: jina.data.content,
    },
    'https://agenciabrasil.ebc.com.br/x': new ScrapeError('Jina: HTTP 403'),
  }
  const reader = new FakeReader(pages)
  const searchClient = new FakeSearch([
    searchResult(ARTICLE_URL),
    searchResult('https://aosfatos.org/checagem'),
    searchResult('https://www.gov.br/saude/nota'),
    searchResult('https://agenciabrasil.ebc.com.br/x', {
      snippet: 'Texto sem relação nenhuma com o assunto.',
    }),
  ])
  const tracker = new UsageTracker()
  const cache = new MemoryCacheStore()
  const deps: PipelineDeps = {
    scraper: new ScraperService(reader, { maxArticleChars: 20000 }),
    claimExtraction: new ClaimExtractionService(llm, { maxClaims: 10 }),
    queryGeneration: new QueryGenerationService(llm),
    search: new SearchService(searchClient, {
      searchTopK: 5,
      excludeFactcheckDomains: true,
      factcheckDomains: FACTCHECK_DOMAINS,
      useTrustedDomains: false,
      trustedDomains: TRUSTED_DOMAINS,
    }),
    evidence: new EvidenceService(reader, {
      evidencePages: 3,
      snippetsPerPage: 3,
      maxArticleChars: 20000,
    }),
    verification: new VerificationService(llm),
    tracker,
    cache,
    model: 'fake-model',
    promptVersions: { 'claim-extraction': '1', 'query-generation': '1', verification: '1' },
    publicConfig: { maxClaims: 10, cachePath: './data/cache.sqlite' },
    thresholds: DEFAULT_SCORING_THRESHOLDS,
    excludeFactcheckDomains: true,
    useTrustedDomains: false,
    now: () => new Date('2026-11-17T12:00:00Z'),
    ...overrides,
  }
  return { deps, reader, searchClient, cache, tracker }
}

describe('VerificationPipeline', () => {
  it('executa o pipeline completo e produz um VerificationResult válido', async () => {
    const llm = scriptedLlm()
    const { deps, searchClient } = makeDeps(llm)
    const events: PipelineEvent[] = []
    const result = await new VerificationPipeline(deps).run(`${ARTICLE_URL}?utm_source=zap`, {
      onEvent: (e) => events.push(e),
    })

    expect(VerificationResultSchema.safeParse(result).success).toBe(true)
    expect(result.article.url).toBe(ARTICLE_URL)
    expect(result.claims).toHaveLength(5)
    // 3 SUPORTADA, 1 CONTRADITA, 1 INSUFICIENTE → s = 0.5, c = 0.8 → VERDADEIRO
    expect(result.claims.map((c) => c.label)).toEqual([
      'SUPORTADA',
      'SUPORTADA',
      'SUPORTADA',
      'INSUFICIENTE',
      'CONTRADITA',
    ])
    expect(result.score).toBe(0.5)
    expect(result.coverage).toBe(0.8)
    expect(result.verdict).toBe('VERDADEIRO')
    expect(result.explanation).toContain('classificada como verdadeira')

    // Transparência: toda afirmação com rótulo decidido traz evidências com URL.
    for (const c of result.claims.filter((c) => c.label !== 'INSUFICIENTE')) {
      expect(c.evidences.length).toBeGreaterThan(0)
      expect(c.evidenceIdsUsed).toEqual(['E1'])
    }
    // Nunca usa o próprio veículo nem agências (flag ligada) como evidência.
    const domains = new Set(result.claims.flatMap((c) => c.evidences.map((e) => e.domain)))
    expect(domains.has('noticias.exemplo.com.br')).toBe(false)
    expect(domains.has('aosfatos.org')).toBe(false)
    expect(searchClient.calls[0]!.options.excludeDomains).toContain('noticias.exemplo.com.br')

    // 1 extração + 1 consultas + verificações (só das afirmações com evidência).
    const verifications = llm.requests.filter((r) => r.promptId === 'verification').length
    expect(llm.requests).toHaveLength(2 + verifications)

    expect(result.meta).toMatchObject({
      model: 'fake-model',
      scrapeMethod: 'jina',
      truncated: false,
      excludedFactcheckDomains: true,
      cacheHit: false,
      timestamp: '2026-11-17T12:00:00.000Z',
    })
    expect(Object.keys(result.meta.latencyMs)).toEqual(
      expect.arrayContaining([
        'scrape',
        'claimExtraction',
        'queryGeneration',
        'search',
        'evidence',
        'scoring',
        'total',
      ]),
    )
    expect(result.meta.warnings).toEqual(
      expect.arrayContaining([
        'Consulta ausente para c3, c4, c5; usado o texto da afirmação',
        expect.stringMatching(/página\(s\) não puderam ser lidas/) as unknown as string,
      ]),
    )

    const stages = events
      .filter((e) => e.type === 'stage' && e.status === 'start')
      .map((e) => e.type === 'stage' && e.stage)
    expect(stages).toEqual(['scrape', 'claims', 'queries', 'evidence', 'scoring'])
    const progress = events.filter((e) => e.type === 'claim-done')
    expect(progress.map((e) => e.type === 'claim-done' && e.done)).toEqual([1, 2, 3, 4, 5])
  })

  it('reaproveita o cache de verificações; --force refaz', async () => {
    const llm = scriptedLlm()
    const { deps } = makeDeps(llm)
    const pipeline = new VerificationPipeline(deps)
    const first = await pipeline.run(ARTICLE_URL)
    const calls = llm.requests.length

    const events: PipelineEvent[] = []
    const second = await pipeline.run(`${ARTICLE_URL}#comentarios`, {
      onEvent: (e) => events.push(e),
    })
    expect(llm.requests).toHaveLength(calls)
    expect(events).toEqual([{ type: 'cache-hit' }])
    expect(second.meta.cacheHit).toBe(true)
    expect(second.verdict).toBe(first.verdict)

    await pipeline.run(ARTICLE_URL, { force: true })
    expect(llm.requests.length).toBeGreaterThan(calls)
  })

  it('falha numa afirmação vira INSUFICIENTE com motivo, sem derrubar a notícia, e não é cacheada', async () => {
    const llm = scriptedLlm([
      ...LABELS.slice(0, 3),
      ['10 a 14 anos', new LlmQuotaError('cota esgotada')],
    ])
    const { deps, cache } = makeDeps(llm)
    const result = await new VerificationPipeline(deps).run(ARTICLE_URL)

    const failed = result.claims.find((c) => c.error)!
    expect(failed).toMatchObject({
      label: 'INSUFICIENTE',
      error: 'cota esgotada',
      rationale: 'Não foi possível verificar esta afirmação: cota esgotada',
    })
    expect(failed.evidences.length).toBeGreaterThan(0)
    expect(result.meta.warnings).toContain(`${failed.claim.id}: cota esgotada`)
    expect(result.claims.filter((c) => c.label === 'SUPORTADA')).toHaveLength(3)

    const hash = verificationConfigHash(deps)
    expect(
      await cache.getVerification(expect.any(String) as unknown as string, hash),
    ).toBeUndefined()
  })

  it('falha ao extrair o texto interrompe com ScrapeError', async () => {
    const { deps } = makeDeps(scriptedLlm())
    await expect(new VerificationPipeline(deps).run('https://outro.site/x')).rejects.toBeInstanceOf(
      Error,
    )
    await expect(new VerificationPipeline(deps).run('url inválida')).rejects.toThrow()
  })

  it('sem afirmações extraídas → IMPRECISO com explicação', async () => {
    const llm = new ScriptedLlm(() => '{"claims": []}')
    const { deps } = makeDeps(llm)
    const result = await new VerificationPipeline(deps).run(ARTICLE_URL)
    expect(result).toMatchObject({ claims: [], score: null, coverage: 0, verdict: 'IMPRECISO' })
    expect(result.explanation).toMatch(/^Não foi possível extrair afirmações/)
    expect(llm.requests.map((r) => r.promptId)).toEqual(['claim-extraction'])
  })

  it('registra o consumo apenas desta execução', async () => {
    const { deps, tracker } = makeDeps(scriptedLlm())
    tracker.recordCall('gemini', { input: 999, output: 999 }) // consumo anterior
    const result = await new VerificationPipeline(deps).run(ARTICLE_URL)
    // Os fakes não registram uso; o que importa é não herdar o consumo anterior.
    expect(result.meta.tokens).toEqual({ input: 0, output: 0 })
    expect(result.meta.apiCalls).toEqual({})
  })
})

describe('verificationConfigHash', () => {
  const base = {
    model: 'm',
    promptVersions: { verification: '1' },
    publicConfig: { maxClaims: 10, cachePath: 'a' },
  }

  it('muda com modelo, versão de prompt ou config relevante', () => {
    const h = verificationConfigHash(base)
    expect(verificationConfigHash({ ...base, model: 'm2' })).not.toBe(h)
    expect(verificationConfigHash({ ...base, promptVersions: { verification: '2' } })).not.toBe(h)
    expect(
      verificationConfigHash({ ...base, publicConfig: { maxClaims: 5, cachePath: 'a' } }),
    ).not.toBe(h)
  })

  it('ignora campos operacionais (caminho do cache, RPM/RPD)', () => {
    expect(
      verificationConfigHash({
        ...base,
        publicConfig: { maxClaims: 10, cachePath: 'b', llmRpm: 99 },
      }),
    ).toBe(verificationConfigHash(base))
  })
})
