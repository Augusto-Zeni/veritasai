import type { ReaderClient } from '../clients/reader.ts'
import type { SearchResult } from '../clients/search.ts'
import type { Claim, Evidence } from '../domain/schemas.ts'
import { bm25Rank, cleanMarkdown, minMatchedTerms, splitPassages, truncateText } from './text.ts'

export interface EvidenceServiceConfig {
  /** Máximo de páginas lidas por afirmação. */
  evidencePages: number
  /** Máximo de trechos selecionados por página. */
  snippetsPerPage: number
  /** Texto de cada página é truncado nesse tamanho antes de dividir em trechos. */
  maxArticleChars: number
}

export interface EvidenceOutput {
  evidences: Evidence[]
  /** Páginas lidas com sucesso. */
  pagesRead: number
  /** URLs que falharam na leitura (com o motivo). */
  failures: Array<{ url: string; reason: string }>
}

interface Candidate {
  result: SearchResult
  /** Trechos da página; vazio se a leitura falhou. */
  passages: string[]
  pageTitle?: string
  publishedAt?: string
}

/**
 * Lê as páginas dos resultados de busca e seleciona os trechos mais relevantes
 * para a afirmação, por ranking lexical BM25 (sem LLM: economiza cota e é determinístico).
 * Se uma página não puder ser lida, o snippet do buscador é usado no lugar.
 */
export class EvidenceService {
  constructor(
    private readonly reader: ReaderClient,
    private readonly config: EvidenceServiceConfig,
  ) {}

  async collect(claim: Claim, results: readonly SearchResult[]): Promise<EvidenceOutput> {
    const failures: EvidenceOutput['failures'] = []
    const candidates: Candidate[] = []
    let pagesRead = 0
    let next = 0

    // Lê em lotes até ter `evidencePages` páginas lidas ou acabarem os resultados.
    while (pagesRead < this.config.evidencePages && next < results.length) {
      const batch = results.slice(next, next + this.config.evidencePages - pagesRead)
      next += batch.length
      const settled = await Promise.allSettled(batch.map((r) => this.reader.read(r.url)))
      settled.forEach((s, i) => {
        const result = batch[i]!
        if (s.status === 'fulfilled' && s.value.text.trim()) {
          pagesRead++
          const text = s.value.method === 'jina' ? cleanMarkdown(s.value.text) : s.value.text
          candidates.push({
            result,
            passages: splitPassages(truncateText(text, this.config.maxArticleChars).text),
            ...(s.value.title ? { pageTitle: s.value.title } : {}),
            ...(s.value.publishedAt ? { publishedAt: s.value.publishedAt } : {}),
          })
        } else {
          const reason = s.status === 'rejected' ? errorMessage(s.reason) : 'texto vazio'
          failures.push({ url: result.url, reason })
          candidates.push({ result, passages: [] })
        }
      })
    }
    // Mantém a ordem do ranking do buscador.
    candidates.sort((a, b) => results.indexOf(a.result) - results.indexOf(b.result))

    return { evidences: this.select(claim, candidates), pagesRead, failures }
  }

  private select(claim: Claim, candidates: Candidate[]): Evidence[] {
    // Ranking conjunto (IDF calculado sobre todos os trechos de todas as páginas).
    const pool: Array<{ candidate: Candidate; text: string; fromSerp: boolean }> = []
    for (const candidate of candidates) {
      if (candidate.passages.length > 0) {
        for (const text of candidate.passages) pool.push({ candidate, text, fromSerp: false })
      } else if (candidate.result.snippet.trim()) {
        pool.push({ candidate, text: candidate.result.snippet.trim(), fromSerp: true })
      }
    }
    const ranked = bm25Rank(
      claim.text,
      pool.map((p) => p.text),
    )
    const minTerms = minMatchedTerms(claim.text)

    const evidences: Evidence[] = []
    for (const candidate of candidates) {
      const best = ranked
        .filter(
          (r) =>
            pool[r.index]!.candidate === candidate && r.matchedTerms >= minTerms && r.score > 0,
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, this.config.snippetsPerPage)
        .sort((a, b) => a.index - b.index) // ordem de leitura dentro da página
      for (const r of best) {
        const { result, pageTitle, publishedAt } = candidate
        const date = publishedAt ?? result.publishedAt
        evidences.push({
          id: `E${evidences.length + 1}`,
          url: result.url,
          domain: result.domain,
          title: pageTitle ?? result.title,
          snippet: pool[r.index]!.text,
          ...(date ? { publishedAt: date } : {}),
        })
      }
    }
    return evidences
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
