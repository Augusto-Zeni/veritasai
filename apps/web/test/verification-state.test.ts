import type { VerificationResult } from '@veritasai/core/domain'
import { describe, expect, it } from 'vitest'
import type { JobEvent } from '../src/lib/api.ts'
import {
  initialVerificationState,
  isFinal,
  verificationReducer,
  type VerificationAction,
  type VerificationState,
} from '../src/lib/verification-state.ts'

function result(overrides: Partial<VerificationResult['meta']> = {}): VerificationResult {
  return {
    article: { url: 'https://exemplo.com.br/a', domain: 'exemplo.com.br', title: 'T', text: '...' },
    claims: [
      {
        claim: { id: 'c1', text: 'A1' },
        query: 'q',
        evidences: [],
        label: 'SUPORTADA',
        rationale: 'r',
        evidenceIdsUsed: [],
      },
      {
        claim: { id: 'c2', text: 'A2' },
        query: 'q',
        evidences: [],
        label: 'INSUFICIENTE',
        rationale: 'r',
        evidenceIdsUsed: [],
      },
    ],
    score: 1,
    coverage: 0.5,
    verdict: 'VERDADEIRO',
    explanation: 'e',
    meta: {
      variant: 'full',
      model: 'm',
      promptVersions: {},
      config: {},
      tokens: { input: 1, output: 1 },
      latencyMs: {},
      apiCalls: {},
      cacheHits: {},
      scrapeMethod: 'jina',
      truncated: true,
      trustedDomainsUsed: false,
      excludedFactcheckDomains: false,
      cacheHit: false,
      warnings: [],
      timestamp: '2026-11-18T12:00:00Z',
      ...overrides,
    },
  }
}

function run(events: JobEvent[], start: VerificationState = initialVerificationState) {
  return events.reduce<VerificationState>(
    (s, event, i) => verificationReducer(s, { type: 'event', id: i + 1, event }),
    start,
  )
}

describe('verificationReducer', () => {
  it('acompanha fila, etapas e afirmações', () => {
    let s = run([{ type: 'queued', position: 2 }])
    expect(s).toMatchObject({ phase: 'queued', queuePosition: 2 })

    s = run([
      { type: 'queued', position: 1 },
      { type: 'started' },
      { type: 'stage', stage: 'scrape', status: 'start' },
      { type: 'article', title: 'Título', domain: 'exemplo.com.br', truncated: false },
      { type: 'stage', stage: 'scrape', status: 'done' },
      { type: 'stage', stage: 'claims', status: 'start' },
      {
        type: 'claims',
        claims: [
          { id: 'c1', text: 'A1' },
          { id: 'c2', text: 'A2' },
        ],
      },
      { type: 'stage', stage: 'evidence', status: 'start' },
      { type: 'claim-done', claimId: 'c2', label: 'CONTRADITA', done: 1, total: 2 },
    ])
    expect(s.phase).toBe('running')
    expect(s.queuePosition).toBeNull()
    expect(s.article).toEqual({ title: 'Título', domain: 'exemplo.com.br', truncated: false })
    // Ao iniciar "evidence", as etapas anteriores (inclusive "queries", sem evento) ficam concluídas.
    expect(s.steps).toEqual({
      scrape: 'done',
      claims: 'done',
      queries: 'done',
      evidence: 'active',
      scoring: 'pending',
    })
    expect(s.labels).toEqual({ c2: 'CONTRADITA' })
    expect({ done: s.done, total: s.total }).toEqual({ done: 1, total: 2 })
    expect(isFinal(s.phase)).toBe(false)
  })

  it('ignora eventos repetidos (reconexão / modo estrito do React)', () => {
    const once = run([{ type: 'started' }, { type: 'claims', claims: [{ id: 'c1', text: 'A1' }] }])
    const again = run(
      [{ type: 'started' }, { type: 'claims', claims: [{ id: 'c9', text: 'outra' }] }],
      once,
    )
    expect(again).toBe(once)
  })

  it('o resultado preenche tudo a partir do VerificationResult', () => {
    const s = run([{ type: 'cache-hit' }, { type: 'result', result: result() }])
    expect(s.phase).toBe('done')
    expect(isFinal(s.phase)).toBe(true)
    expect(Object.values(s.steps).every((v) => v === 'done')).toBe(true)
    expect(s.labels).toEqual({ c1: 'SUPORTADA', c2: 'INSUFICIENTE' })
    expect(s.article).toEqual({ title: 'T', domain: 'exemplo.com.br', truncated: true })
    expect(s.cacheHit).toBe(true)
  })

  it('erro público vira fase de erro', () => {
    const s = run([{ type: 'error', error: { code: 'SCRAPE', message: 'm' } }])
    expect(s).toMatchObject({ phase: 'error', error: { code: 'SCRAPE' } })
  })

  it('snapshot, not-found, failed e reconexão', () => {
    const reduce = (a: VerificationAction, s = initialVerificationState) =>
      verificationReducer(s, a)
    const snap = reduce({
      type: 'snapshot',
      job: { id: 'x', url: 'u', status: 'done', createdAt: '', result: result() },
    })
    expect(snap.phase).toBe('done')
    const snapErr = reduce({
      type: 'snapshot',
      job: {
        id: 'x',
        url: 'u',
        status: 'error',
        createdAt: '',
        error: { code: 'C', message: 'm' },
      },
    })
    expect(snapErr.phase).toBe('error')
    const running = reduce({
      type: 'snapshot',
      job: { id: 'x', url: 'u', status: 'running', createdAt: '' },
    })
    expect(running).toBe(initialVerificationState)
    expect(reduce({ type: 'not-found' }).phase).toBe('not-found')
    expect(reduce({ type: 'failed', error: { code: 'N', message: 'm' } }).phase).toBe('error')

    const rec = reduce({ type: 'connection', status: 'reconnecting' })
    expect(rec.reconnecting).toBe(true)
    expect(
      verificationReducer(rec, { type: 'event', id: 1, event: { type: 'started' } }).reconnecting,
    ).toBe(false)
  })
})
