import type { GenerateOptions, LlmClient, LlmRequest, LlmResponse } from '../src/clients/llm.ts'
import type { ReaderClient, ReadResult } from '../src/clients/reader.ts'
import type { SearchClient, SearchOptions, SearchResult } from '../src/clients/search.ts'

/** LLM falso: devolve as saídas na ordem (texto ou erro) e grava as requisições. */
export class FakeLlm implements LlmClient {
  readonly model = 'fake-model'
  readonly requests: LlmRequest[] = []
  constructor(private readonly outputs: Array<string | Error>) {}

  async generate(request: LlmRequest, _options?: GenerateOptions): Promise<LlmResponse> {
    this.requests.push(request)
    const next = this.outputs.shift()
    if (next === undefined) throw new Error('FakeLlm: sem saídas')
    if (next instanceof Error) throw next
    return { text: next, model: this.model, usage: { input: 10, output: 5 }, cached: false }
  }
}

/** Leitor falso: resposta (ou erro) por URL. */
export class FakeReader implements ReaderClient {
  readonly reads: string[] = []
  constructor(private readonly pages: Record<string, ReadResult | Error>) {}

  async read(url: string): Promise<ReadResult> {
    this.reads.push(url)
    const page = this.pages[url]
    if (!page) throw new Error(`FakeReader: página não cadastrada ${url}`)
    if (page instanceof Error) throw page
    return page
  }
}

/** Buscador falso: devolve sempre a mesma lista, aplicando `excludeDomains` e `num`. */
export class FakeSearch implements SearchClient {
  readonly calls: Array<{ query: string; options: SearchOptions }> = []
  constructor(private readonly results: SearchResult[]) {}

  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    this.calls.push({ query, options })
    const excluded = options.excludeDomains ?? []
    return this.results
      .filter((r) => !excluded.some((d) => r.domain === d || r.domain.endsWith(`.${d}`)))
      .slice(0, options.num)
  }
}

export const searchResult = (url: string, overrides: Partial<SearchResult> = {}): SearchResult => ({
  url,
  domain: new URL(url).hostname.replace(/^www\./, ''),
  title: `Título de ${url}`,
  snippet: '',
  position: 1,
  ...overrides,
})
