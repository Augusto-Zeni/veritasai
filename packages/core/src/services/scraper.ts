import type { ReaderClient } from '../clients/reader.ts'
import type { Article, ScrapeMethod } from '../domain/schemas.ts'
import { ScrapeError } from '../errors.ts'
import { domainOf, normalizeUrl } from '../utils/url.ts'
import { cleanMarkdown, truncateText } from './text.ts'

export interface ScrapeOutput {
  article: Article
  method: ScrapeMethod
  truncated: boolean
  /** Tamanho do texto antes do truncamento. */
  originalChars: number
}

/** Extrai o texto da notícia (Jina → Readability) e trunca em `maxArticleChars`. */
export class ScraperService {
  constructor(
    private readonly reader: ReaderClient,
    private readonly config: { maxArticleChars: number },
  ) {}

  async scrape(rawUrl: string): Promise<ScrapeOutput> {
    let url: string
    try {
      url = normalizeUrl(rawUrl)
    } catch (cause) {
      throw new ScrapeError(`URL inválida: ${rawUrl}`, { cause })
    }
    const read = await this.reader.read(url)
    const clean = read.method === 'jina' ? cleanMarkdown(read.text) : read.text
    if (!clean) throw new ScrapeError(`Nenhum texto extraído de ${url}`)
    const { text, truncated } = truncateText(clean, this.config.maxArticleChars)

    return {
      article: {
        url,
        domain: domainOf(url),
        text,
        ...(read.title ? { title: read.title } : {}),
        ...(read.publishedAt ? { publishedAt: read.publishedAt } : {}),
      },
      method: read.method,
      truncated,
      originalChars: clean.length,
    }
  }
}
