import { describe, expect, it } from 'vitest'
import type { Article } from '../src/domain/schemas.ts'
import { LlmOutputError } from '../src/errors.ts'
import { ClaimExtractionService } from '../src/services/claim-extraction.ts'
import { FakeLlm } from './fakes.ts'
import { fixture } from './helpers.ts'

const article: Article = {
  url: 'https://noticias.exemplo.com.br/saude/vacina-dengue',
  domain: 'noticias.exemplo.com.br',
  title: 'Governo amplia vacinação contra a dengue',
  publishedAt: '2024-02-05',
  text: 'O Ministério da Saúde anunciou nesta segunda-feira (5)...',
}

describe('ClaimExtractionService', () => {
  it('monta o prompt com a notícia e o limite de afirmações', async () => {
    const llm = new FakeLlm([fixture('llm/claim-extraction.json')])
    await new ClaimExtractionService(llm, { maxClaims: 10 }).extract(article)
    const req = llm.requests[0]!
    expect(req.promptId).toBe('claim-extraction')
    expect(req.promptVersion).toMatch(/^\d+$/)
    expect(req.system).toContain('no máximo 10 afirmações')
    expect(req.prompt).toContain('Título: Governo amplia vacinação contra a dengue')
    expect(req.prompt).toContain(article.text)
    expect(req.responseJsonSchema).toBeDefined()
  })

  it('numera, limpa, remove repetidas e descarta afirmações curtas demais', async () => {
    const llm = new FakeLlm([fixture('llm/claim-extraction.json')])
    const claims = await new ClaimExtractionService(llm, { maxClaims: 10 }).extract(article)
    expect(claims.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5'])
    expect(claims[0]).toMatchObject({
      text: expect.stringContaining('5 de fevereiro de 2024') as unknown as string,
      sourceSentence: expect.stringContaining('nesta segunda-feira (5)') as unknown as string,
    })
    expect(claims[3]).not.toHaveProperty('sourceSentence')
  })

  it('respeita maxClaims mesmo que o LLM devolva mais', async () => {
    const llm = new FakeLlm([fixture('llm/claim-extraction.json')])
    expect(await new ClaimExtractionService(llm, { maxClaims: 2 }).extract(article)).toHaveLength(2)
  })

  it('saída inválida do LLM propaga LlmOutputError', async () => {
    const llm = new FakeLlm(['{"afirmacoes": []}'])
    await expect(
      new ClaimExtractionService(llm, { maxClaims: 10 }).extract(article),
    ).rejects.toBeInstanceOf(LlmOutputError)
  })
})
