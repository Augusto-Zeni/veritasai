import type { ClaimLabel, NewsVerdict, Variant, VerificationResult } from '@veritasai/core'
import type { RunRecord } from '../src/runs.ts'

/** Registro sintético de execução: rótulos das afirmações + veredito gravado. */
export function record(
  id: string,
  expected: NewsVerdict,
  verdict: NewsVerdict,
  labels: ClaimLabel[] = [],
  variant: Variant = 'full',
): RunRecord {
  const result: VerificationResult = {
    article: {
      url: `https://exemplo.com.br/${id}`,
      domain: 'exemplo.com.br',
      title: `Notícia ${id}`,
      text: '...',
    },
    claims: labels.map((label, i) => ({
      claim: { id: `c${i + 1}`, text: `Afirmação ${i + 1} da notícia ${id}.` },
      query: 'q',
      evidences: [
        { id: 'E1', url: 'https://gov.br/x', domain: 'gov.br', title: 'Fonte', snippet: 'Trecho.' },
      ],
      label,
      rationale: `Justificativa ${i + 1}.`,
      evidenceIdsUsed: label === 'INSUFICIENTE' ? [] : ['E1'],
    })),
    score: null,
    coverage: 0,
    verdict,
    explanation: 'Explicação.',
    meta: {
      variant,
      model: 'm',
      promptVersions: {},
      config: {},
      tokens: { input: 100, output: 10 },
      latencyMs: { total: 1000, scrape: 100 },
      apiCalls: { gemini: 3, serper: 2 },
      cacheHits: {},
      scrapeMethod: 'jina',
      truncated: false,
      trustedDomainsUsed: false,
      excludedFactcheckDomains: false,
      cacheHit: false,
      warnings: [],
      timestamp: '2026-11-18T12:00:00Z',
    },
  }
  return { id, url: result.article.url, split: 'teste', expected, result }
}
