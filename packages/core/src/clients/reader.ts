import { z } from 'zod'
import { ScrapeMethodSchema } from '../domain/schemas.ts'
import { ScrapeError } from '../errors.ts'

export const ReadResultSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  text: z.string(),
  publishedAt: z.string().optional(),
  method: ScrapeMethodSchema,
})
export type ReadResult = z.infer<typeof ReadResultSchema>

/** Extrai o texto principal de uma página (notícia ou página de evidência). */
export interface ReaderClient {
  read(url: string): Promise<ReadResult>
}

export interface FallbackReaderOptions {
  primary: ReaderClient
  fallback: ReaderClient
  /** Texto do primário abaixo disso é considerado falho (padrão 500). */
  minChars?: number
  onFallback?: (info: { url: string; reason: string }) => void
}

/**
 * Tenta o leitor primário (Jina); se falhar ou devolver texto curto demais,
 * usa o secundário (Readability). O método usado fica em `ReadResult.method`.
 */
export class FallbackReader implements ReaderClient {
  constructor(private readonly options: FallbackReaderOptions) {}

  async read(url: string): Promise<ReadResult> {
    const { primary, fallback, minChars = 500, onFallback } = this.options
    let primaryResult: ReadResult | undefined
    let reason: string
    try {
      primaryResult = await primary.read(url)
      if (primaryResult.text.length >= minChars) return primaryResult
      reason = `texto curto (${primaryResult.text.length} < ${minChars} caracteres)`
    } catch (err) {
      reason = err instanceof Error ? err.message : String(err)
    }
    onFallback?.({ url, reason })

    try {
      const result = await fallback.read(url)
      // Se os dois devolveram texto, fica com o mais longo.
      if (primaryResult && primaryResult.text.length > result.text.length) return primaryResult
      return result
    } catch (err) {
      if (primaryResult && primaryResult.text.length > 0) return primaryResult
      const fallbackReason = err instanceof Error ? err.message : String(err)
      throw new ScrapeError(
        `Não foi possível extrair o texto de ${url}: ${reason}; alternativa: ${fallbackReason}`,
        { cause: err },
      )
    }
  }
}
