import { describe, expect, it } from 'vitest'
import { formatResult } from '../src/cli.ts'
import type { VerificationResult } from '../src/domain/schemas.ts'

const result: VerificationResult = {
  article: {
    url: 'https://exemplo.com.br/n',
    domain: 'exemplo.com.br',
    title: 'Título',
    text: '...',
  },
  claims: [
    {
      claim: { id: 'c1', text: 'Afirmação um.' },
      query: 'consulta um',
      evidences: [
        {
          id: 'E1',
          url: 'https://gov.br/a',
          domain: 'gov.br',
          title: 'Fonte A',
          snippet: 'Trecho.',
        },
        { id: 'E2', url: 'https://x.com/b', domain: 'x.com', title: 'Fonte B', snippet: 'Trecho.' },
      ],
      label: 'SUPORTADA',
      rationale: 'E1 confirma.',
      evidenceIdsUsed: ['E1'],
    },
    {
      claim: { id: 'c2', text: 'Afirmação dois.' },
      query: 'consulta dois',
      evidences: [],
      label: 'INSUFICIENTE',
      rationale: 'Sem evidências.',
      evidenceIdsUsed: [],
    },
  ],
  score: 1,
  coverage: 0.5,
  verdict: 'VERDADEIRO',
  explanation: 'Explicação.',
  meta: {
    model: 'gemini-x',
    promptVersions: { verification: '1' },
    config: {},
    tokens: { input: 1000, output: 200 },
    latencyMs: { total: 12_345 },
    apiCalls: { gemini: 3 },
    cacheHits: {},
    scrapeMethod: 'jina',
    truncated: false,
    trustedDomainsUsed: false,
    excludedFactcheckDomains: false,
    cacheHit: false,
    warnings: ['c2: algo'],
    timestamp: '2026-11-17T12:00:00Z',
  },
}

describe('formatResult', () => {
  it('mostra veredito, cobertura em linguagem simples, fontes, custo e o aviso', () => {
    const out = formatResult(result)
    expect(out).toContain('Veredito: ✔ VERDADEIRO')
    expect(out).toContain('1 de 2 afirmações teve evidências suficientes')
    expect(out).toContain('  *[E1] gov.br — Fonte A')
    expect(out).toContain('   [E2] x.com — Fonte B')
    expect(out).toContain('https://gov.br/a')
    expect(out).toContain('Tokens: 1000 entrada + 200 saída')
    expect(out).toContain('Tempo total: 12.3 s')
    expect(out).toContain('  - c2: algo')
    expect(out).toContain('Não substitui checagem profissional')
  })
})
