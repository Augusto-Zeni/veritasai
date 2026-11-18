import type { PipelineEvent, RunOptions, VerificationResult, Verifier } from '@veritasai/core'

export function fakeResult(url: string): VerificationResult {
  return {
    article: { url, domain: new URL(url).hostname, title: 'Notícia de teste', text: '...' },
    claims: [
      {
        claim: { id: 'c1', text: 'Afirmação de teste.' },
        query: 'consulta',
        evidences: [
          {
            id: 'E1',
            url: 'https://gov.br/x',
            domain: 'gov.br',
            title: 'Fonte',
            snippet: 'Trecho.',
          },
        ],
        label: 'SUPORTADA',
        rationale: 'A fonte confirma.',
        evidenceIdsUsed: ['E1'],
      },
    ],
    score: 1,
    coverage: 1,
    verdict: 'VERDADEIRO',
    explanation: 'Explicação.',
    meta: {
      variant: 'full',
      model: 'fake',
      promptVersions: {},
      config: {},
      tokens: { input: 10, output: 1 },
      latencyMs: { total: 5 },
      apiCalls: {},
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
}

const STEPS: PipelineEvent[] = [
  { type: 'stage', stage: 'scrape', status: 'start' },
  { type: 'article', title: 'Notícia de teste', domain: 'exemplo.com.br', truncated: false },
  { type: 'stage', stage: 'scrape', status: 'done' },
  { type: 'claims', claims: [{ id: 'c1', text: 'Afirmação de teste.' }] },
  { type: 'claim-done', claimId: 'c1', label: 'SUPORTADA', done: 1, total: 1 },
]

/**
 * Verificador controlável: cada chamada a run() fica pendente até `release(url)`
 * (ou `fail(url, err)`). Com `auto: true`, termina sozinho.
 */
export class FakeVerifier implements Verifier {
  readonly calls: { url: string; options: RunOptions }[] = []
  private readonly pending = new Map<
    string,
    {
      resolve: (r: VerificationResult) => void
      reject: (e: unknown) => void
      emit: (e: PipelineEvent) => void
    }
  >()

  constructor(private readonly opts: { auto?: boolean; error?: unknown } = {}) {}

  run(url: string, options: RunOptions = {}): Promise<VerificationResult> {
    this.calls.push({ url, options })
    const emit = options.onEvent ?? (() => {})
    for (const e of STEPS.slice(0, 3)) emit(e)
    if (this.opts.error) return Promise.reject(this.opts.error)
    if (this.opts.auto) {
      for (const e of STEPS.slice(3)) emit(e)
      return Promise.resolve(fakeResult(url))
    }
    return new Promise((resolve, reject) => this.pending.set(url, { resolve, reject, emit }))
  }

  isRunning(url: string): boolean {
    return this.pending.has(url)
  }

  release(url: string): void {
    const p = this.pending.get(url)
    if (!p) throw new Error(`nenhuma execução pendente para ${url}`)
    this.pending.delete(url)
    for (const e of STEPS.slice(3)) p.emit(e)
    p.resolve(fakeResult(url))
  }

  fail(url: string, err: unknown): void {
    const p = this.pending.get(url)
    if (!p) throw new Error(`nenhuma execução pendente para ${url}`)
    this.pending.delete(url)
    p.reject(err)
  }
}

/** Deixa as promessas pendentes andarem. */
export const flush = () => new Promise((r) => setImmediate(r))
