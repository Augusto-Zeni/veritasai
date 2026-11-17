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

/**
 * Consumo entre dois snapshots (`after - before`). Usado para isolar o custo de
 * uma notícia quando o mesmo tracker atende várias execuções seguidas.
 */
export function diffUsage(before: UsageSnapshot, after: UsageSnapshot): UsageSnapshot {
  const sub = (a: Record<string, number>, b: Record<string, number>) =>
    Object.fromEntries(
      Object.entries(a)
        .map(([k, v]) => [k, v - (b[k] ?? 0)] as const)
        .filter(([, v]) => v > 0),
    )
  return {
    tokens: {
      input: after.tokens.input - before.tokens.input,
      output: after.tokens.output - before.tokens.output,
    },
    apiCalls: sub(after.apiCalls, before.apiCalls),
    cacheHits: sub(after.cacheHits, before.cacheHits),
  }
}
