/**
 * Cliente da API (apps/api). Em desenvolvimento, o Vite encaminha /api → localhost:3000.
 * Os tipos dos eventos espelham `JobEvent` de apps/api/src/jobs.ts (contrato do SSE).
 */
import type { Claim, ClaimLabel, VerificationResult } from '@veritasai/core/domain'

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export type PipelineStage = 'scrape' | 'claims' | 'queries' | 'evidence' | 'scoring'

export interface PublicError {
  code: string
  message: string
}

export type JobEvent =
  | { type: 'queued'; position: number }
  | { type: 'started' }
  | { type: 'stage'; stage: PipelineStage; status: 'start' | 'done' }
  | { type: 'article'; title?: string; domain: string; truncated: boolean }
  | { type: 'claims'; claims: Claim[] }
  | { type: 'claim-done'; claimId: string; label: ClaimLabel; done: number; total: number }
  | { type: 'cache-hit' }
  | { type: 'result'; result: VerificationResult }
  | { type: 'error'; error: PublicError }

export const JOB_EVENT_TYPES = [
  'queued',
  'started',
  'stage',
  'article',
  'claims',
  'claim-done',
  'cache-hit',
  'result',
  'error',
] as const satisfies readonly JobEvent['type'][]

export type JobStatus = 'queued' | 'running' | 'done' | 'error'

export interface JobSummary {
  id: string
  url: string
  status: JobStatus
  createdAt: string
  result?: VerificationResult
  error?: PublicError
}

export interface Health {
  status: string
  ready: boolean
  reason?: string
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const NETWORK_MESSAGE =
  'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, init)
  } catch {
    throw new ApiError('NETWORK', NETWORK_MESSAGE, 0)
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: PublicError }) | null
  if (!res.ok) {
    throw new ApiError(
      body?.error?.code ?? 'HTTP',
      body?.error?.message ?? `Erro inesperado do servidor (${res.status}).`,
      res.status,
    )
  }
  if (body === null) throw new ApiError('HTTP', 'Resposta inválida do servidor.', res.status)
  return body
}

export function getHealth(): Promise<Health> {
  return request<Health>('/health')
}

export function createVerification(
  url: string,
  force = false,
): Promise<{ id: string; status: JobStatus; reused: boolean }> {
  return request('/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(force ? { url, force } : { url }),
  })
}

export function getVerification(id: string): Promise<JobSummary> {
  return request<JobSummary>(`/verify/${encodeURIComponent(id)}`)
}

export function streamUrl(id: string): string {
  return `${API_BASE}/verify/${encodeURIComponent(id)}/stream`
}
