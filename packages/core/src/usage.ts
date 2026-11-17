import type { TokenUsage } from './domain/schemas.ts'

export type ExternalApi = 'gemini' | 'serper' | 'jina' | 'readability'

export interface UsageSnapshot {
  tokens: TokenUsage
  apiCalls: Record<string, number>
  cacheHits: Record<string, number>
}

/**
 * Acumula o consumo real de uma execução (tokens e chamadas por API).
 * Respostas vindas do cache contam em `cacheHits`, não em `apiCalls`/`tokens`.
 */
export class UsageTracker {
  private input = 0
  private output = 0
  private readonly calls: Record<string, number> = {}
  private readonly hits: Record<string, number> = {}

  recordCall(api: ExternalApi, tokens?: TokenUsage): void {
    this.calls[api] = (this.calls[api] ?? 0) + 1
    if (tokens) {
      this.input += tokens.input
      this.output += tokens.output
    }
  }

  recordCacheHit(api: ExternalApi): void {
    this.hits[api] = (this.hits[api] ?? 0) + 1
  }

  snapshot(): UsageSnapshot {
    return {
      tokens: { input: this.input, output: this.output },
      apiCalls: { ...this.calls },
      cacheHits: { ...this.hits },
    }
  }
}
