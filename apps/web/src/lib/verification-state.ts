/**
 * Estado da tela de verificação, montado a partir dos eventos do SSE (função pura).
 * Idempotente: eventos com id já visto são ignorados (reconexões e o modo estrito do
 * React podem entregar o histórico mais de uma vez).
 */
import type { Claim, ClaimLabel, VerificationResult } from '@veritasai/core/domain'
import type { JobEvent, JobSummary, PipelineStage, PublicError } from './api.ts'

export type StepStatus = 'pending' | 'active' | 'done'

export type Phase = 'connecting' | 'queued' | 'running' | 'done' | 'error' | 'not-found'

export const STAGES: readonly PipelineStage[] = [
  'scrape',
  'claims',
  'queries',
  'evidence',
  'scoring',
]

export interface VerificationState {
  phase: Phase
  lastEventId: number
  queuePosition: number | null
  steps: Record<PipelineStage, StepStatus>
  article: { title?: string; domain: string; truncated: boolean } | null
  claims: Claim[]
  labels: Record<string, ClaimLabel>
  done: number
  total: number
  cacheHit: boolean
  reconnecting: boolean
  result: VerificationResult | null
  error: PublicError | null
}

export type VerificationAction =
  | { type: 'event'; id: number; event: JobEvent }
  | { type: 'connection'; status: 'open' | 'reconnecting' }
  | { type: 'snapshot'; job: JobSummary }
  | { type: 'not-found' }
  | { type: 'failed'; error: PublicError }

const allSteps = (status: StepStatus): Record<PipelineStage, StepStatus> => ({
  scrape: status,
  claims: status,
  queries: status,
  evidence: status,
  scoring: status,
})

export const initialVerificationState: VerificationState = {
  phase: 'connecting',
  lastEventId: 0,
  queuePosition: null,
  steps: allSteps('pending'),
  article: null,
  claims: [],
  labels: {},
  done: 0,
  total: 0,
  cacheHit: false,
  reconnecting: false,
  result: null,
  error: null,
}

function withResult(state: VerificationState, result: VerificationResult): VerificationState {
  return {
    ...state,
    phase: 'done',
    queuePosition: null,
    steps: allSteps('done'),
    article: {
      ...(result.article.title ? { title: result.article.title } : {}),
      domain: result.article.domain,
      truncated: result.meta.truncated,
    },
    claims: result.claims.map((c) => c.claim),
    labels: Object.fromEntries(result.claims.map((c) => [c.claim.id, c.label])),
    done: result.claims.length,
    total: result.claims.length,
    cacheHit: state.cacheHit || result.meta.cacheHit,
    reconnecting: false,
    result,
    error: null,
  }
}

function applyEvent(state: VerificationState, event: JobEvent): VerificationState {
  switch (event.type) {
    case 'queued':
      return { ...state, phase: 'queued', queuePosition: event.position }
    case 'started':
      return { ...state, phase: 'running', queuePosition: null }
    case 'stage': {
      const steps = { ...state.steps }
      if (event.status === 'done') {
        steps[event.stage] = 'done'
      } else {
        // Ao iniciar uma etapa, as anteriores estão concluídas.
        for (const s of STAGES) {
          if (s === event.stage) break
          steps[s] = 'done'
        }
        steps[event.stage] = 'active'
      }
      return { ...state, phase: 'running', steps }
    }
    case 'article':
      return {
        ...state,
        article: {
          ...(event.title ? { title: event.title } : {}),
          domain: event.domain,
          truncated: event.truncated,
        },
      }
    case 'claims':
      return { ...state, claims: event.claims, total: event.claims.length }
    case 'claim-done':
      return {
        ...state,
        labels: { ...state.labels, [event.claimId]: event.label },
        done: Math.max(state.done, event.done),
        total: event.total,
      }
    case 'cache-hit':
      return { ...state, cacheHit: true }
    case 'result':
      return withResult(state, event.result)
    case 'error':
      return { ...state, phase: 'error', queuePosition: null, error: event.error }
  }
}

export function verificationReducer(
  state: VerificationState,
  action: VerificationAction,
): VerificationState {
  switch (action.type) {
    case 'event':
      if (action.id <= state.lastEventId) return state
      return { ...applyEvent(state, action.event), lastEventId: action.id, reconnecting: false }
    case 'connection':
      return { ...state, reconnecting: action.status === 'reconnecting' }
    case 'snapshot': {
      const { job } = action
      if (job.result) return withResult(state, job.result)
      if (job.error) return { ...state, phase: 'error', error: job.error, reconnecting: false }
      return state
    }
    case 'not-found':
      return { ...state, phase: 'not-found', reconnecting: false }
    case 'failed':
      return { ...state, phase: 'error', error: action.error, reconnecting: false }
  }
}

/** Terminou (com resultado ou erro)? */
export function isFinal(phase: Phase): boolean {
  return phase === 'done' || phase === 'error' || phase === 'not-found'
}
