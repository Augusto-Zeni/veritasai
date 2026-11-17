/**
 * - verificações por URL normalizada (economiza cota de API);
 * - respostas de serviços externos (reprodutibilidade). O `namespace` identifica
 *   a origem: o nome do modelo para o LLM, `serper` para busca, `jina`/`readability`
 *   para extração de texto.
 *
 * Os valores são guardados como JSON e devolvidos como `unknown`:
 * quem lê valida com Zod.
 */
export interface CacheStore {
  getVerification(urlHash: string, configHash: string): Promise<unknown>
  setVerification(urlHash: string, configHash: string, result: unknown): Promise<void>
  getResponse(namespace: string, key: string): Promise<unknown>
  setResponse(namespace: string, key: string, value: unknown): Promise<void>
  close(): Promise<void>
}
