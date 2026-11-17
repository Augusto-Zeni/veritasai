import type { CacheStore } from './cache-store.ts'

/** Cache em memória (testes e execuções sem persistência). */
export class MemoryCacheStore implements CacheStore {
  private readonly verifications = new Map<string, string>()
  private readonly responses = new Map<string, string>()

  async getVerification(urlHash: string, configHash: string): Promise<unknown> {
    return parse(this.verifications.get(`${urlHash}:${configHash}`))
  }

  async setVerification(urlHash: string, configHash: string, result: unknown): Promise<void> {
    this.verifications.set(`${urlHash}:${configHash}`, JSON.stringify(result))
  }

  async getResponse(namespace: string, key: string): Promise<unknown> {
    return parse(this.responses.get(`${namespace}:${key}`))
  }

  async setResponse(namespace: string, key: string, value: unknown): Promise<void> {
    this.responses.set(`${namespace}:${key}`, JSON.stringify(value))
  }

  async close(): Promise<void> {}
}

function parse(json: string | undefined): unknown {
  return json === undefined ? undefined : JSON.parse(json)
}
