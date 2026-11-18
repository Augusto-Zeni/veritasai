import type { ReaderClient, ReadResult } from '../clients/reader.ts'
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

/** Texto já disponível (ex.: post de rede social transcrito no dataset); dispensa a leitura. */
export interface ProvidedText {
  text: string
  title?: string
}

/** Extrai o texto da notícia (Jina → Readability) e trunca em `maxArticleChars`. */
export class ScraperService {
  constructor(
    private readonly reader: ReaderClient,
    private readonly config: { maxArticleChars: number },
  ) {}

  async scrape(rawUrl: string, provided?: ProvidedText): Promise<ScrapeOutput> {
    let url: string
    try {
      url = normalizeUrl(rawUrl)
    } catch (cause) {
      throw new ScrapeError(`URL inválida: ${rawUrl}`, { cause })
    }
    const read: Omit<ReadResult, 'url'> = provided
      ? {
          text: provided.text.trim(),
          method: 'texto',
          ...(provided.title ? { title: provided.title } : {}),
        }
      : await this.reader.read(url)
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
