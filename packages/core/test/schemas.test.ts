import { describe, expect, it } from 'vitest'
import { ClaimResultSchema, VerificationResultSchema } from '../src/domain/schemas.ts'

const claimResult = {
  claim: { id: 'c1', text: 'O IBGE divulgou a taxa de desemprego de 2025 em janeiro de 2026.' },
  query: 'IBGE taxa de desemprego 2025',
  evidences: [
    {
      id: 'E1',
      url: 'https://agenciadenoticias.ibge.gov.br/x',
      domain: 'agenciadenoticias.ibge.gov.br',
      title: 'Desemprego',
      snippet: 'A taxa ficou em...',
    },
  ],
  label: 'SUPORTADA',
  rationale: 'A evidência confirma.',
  evidenceIdsUsed: ['E1'],
}

const result = {
  article: { url: 'https://exemplo.com.br/noticia', domain: 'exemplo.com.br', text: '...' },
  claims: [claimResult],
  score: 1,
  coverage: 1,
  verdict: 'VERDADEIRO',
  explanation: '1 de 1 afirmações confirmadas.',
  meta: {
    model: 'gemini-x',
    promptVersions: { 'claim-extraction': '1' },
    config: {},
    tokens: { input: 10, output: 5 },
    latencyMs: { scrape: 100 },
    apiCalls: { gemini: 2 },
    scrapeMethod: 'jina',
    truncated: false,
    trustedDomainsUsed: false,
    excludedFactcheckDomains: false,
    cacheHit: false,
    cacheHits: {},
    warnings: [],
    timestamp: '2026-11-17T12:00:00Z',
  },
}

describe('schemas de domínio', () => {
  it('aceita um VerificationResult válido', () => {
    expect(VerificationResultSchema.parse(result)).toBeTruthy()
  })

  it('rejeita rótulo desconhecido', () => {
    expect(ClaimResultSchema.safeParse({ ...claimResult, label: 'TALVEZ' }).success).toBe(false)
  })

  it('rejeita score fora de [-1, 1] e aceita null', () => {
    expect(VerificationResultSchema.safeParse({ ...result, score: 1.5 }).success).toBe(false)
    expect(VerificationResultSchema.safeParse({ ...result, score: null }).success).toBe(true)
  })

  it('rejeita evidência sem URL válida (transparência)', () => {
    const bad = { ...claimResult, evidences: [{ ...claimResult.evidences[0], url: 'nao-e-url' }] }
    expect(ClaimResultSchema.safeParse(bad).success).toBe(false)
  })
})
