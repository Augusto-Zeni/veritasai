import { describe, expect, it } from 'vitest'
import type { Claim } from '../src/domain/schemas.ts'
import { LlmQuotaError } from '../src/errors.ts'
import { QueryGenerationService, sanitizeQuery } from '../src/services/query-generation.ts'
import { FakeLlm } from './fakes.ts'
import { fixture } from './helpers.ts'

const claims: Claim[] = [
  { id: 'c1', text: 'O Ministério da Saúde ampliou a vacinação contra a dengue para 16 estados.' },
  { id: 'c2', text: 'Serão distribuídas 1,2 milhão de doses até março de 2024.' },
  { id: 'c3', text: 'A vacina é produzida pelo laboratório "Takeda".' },
]

describe('QueryGenerationService', () => {
  it('gera todas as consultas numa única chamada e usa o texto da afirmação quando falta uma', async () => {
    const llm = new FakeLlm([fixture('llm/query-generation.json')])
    const out = await new QueryGenerationService(llm).generate(claims)
    expect(llm.requests).toHaveLength(1)
    expect(llm.requests[0]!.prompt).toContain('[c2] Serão distribuídas')
    expect(out.queries.get('c1')).toBe(
      'Ministério da Saúde amplia vacinação dengue 16 estados fevereiro 2024',
    )
    // aspas e site: removidos
    expect(out.queries.get('c2')).toBe('1,2 milhão de doses vacina dengue')
    expect(out.queries.get('c3')).toBe('A vacina é produzida pelo laboratório Takeda.')
    expect(out.queries.has('c99')).toBe(false)
    expect(out.fallbackIds).toEqual(['c3'])
    expect(out.error).toBeUndefined()
  })

  it('se o LLM falhar, degrada para o texto das afirmações e registra o motivo', async () => {
    const llm = new FakeLlm([new LlmQuotaError('cota esgotada')])
    const out = await new QueryGenerationService(llm).generate(claims)
    expect(out.fallbackIds).toEqual(['c1', 'c2', 'c3'])
    expect(out.error).toBe('cota esgotada')
    expect(out.queries.size).toBe(3)
  })

  it('não chama o LLM sem afirmações', async () => {
    const llm = new FakeLlm([])
    expect((await new QueryGenerationService(llm).generate([])).queries.size).toBe(0)
    expect(llm.requests).toHaveLength(0)
  })
})

describe('sanitizeQuery', () => {
  it('remove aspas e operadores', () => {
    expect(sanitizeQuery('"vacina dengue" site:gov.br -fake OR boato  intitle:x')).toBe(
      'vacina dengue boato',
    )
  })
})
