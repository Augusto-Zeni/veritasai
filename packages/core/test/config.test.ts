import { describe, expect, it } from 'vitest'
import { DEFAULT_SCORING_THRESHOLDS, loadConfig, publicConfig } from '../src/config.ts'

describe('loadConfig', () => {
  it('usa padrões quando o ambiente está vazio', () => {
    const c = loadConfig({})
    expect(c).toMatchObject({
      llmRpm: 5,
      llmRpd: 100,
      maxArticleChars: 20000,
      maxClaims: 10,
      searchTopK: 5,
      evidencePages: 3,
      excludeFactcheckDomains: false,
      cachePath: './data/cache.sqlite',
    })
    expect(c.scoring).toEqual(DEFAULT_SCORING_THRESHOLDS)
  })

  it('lê números e booleanos do ambiente; vazio conta como ausente', () => {
    const c = loadConfig({ MAX_CLAIMS: '7', EXCLUDE_FACTCHECK_DOMAINS: 'true', LLM_RPM: '  ' })
    expect(c.maxClaims).toBe(7)
    expect(c.excludeFactcheckDomains).toBe(true)
    expect(c.llmRpm).toBe(5)
  })

  it("'false' vira false (não true, como em z.coerce.boolean)", () => {
    expect(loadConfig({ EXCLUDE_FACTCHECK_DOMAINS: 'false' }).excludeFactcheckDomains).toBe(false)
  })

  it('rejeita valores inválidos', () => {
    expect(() => loadConfig({ MAX_CLAIMS: 'dez' })).toThrow()
    expect(() => loadConfig({ SEARCH_TOP_K: '0' })).toThrow()
    expect(() => loadConfig({ EXCLUDE_FACTCHECK_DOMAINS: 'sim' })).toThrow()
  })

  it('aceita overrides (ex.: limiares calibrados)', () => {
    const scoring = { coverageMin: 0.6, trueMin: 0.4, falseMax: -0.2 }
    expect(loadConfig({}, { scoring }).scoring).toEqual(scoring)
  })
})

describe('publicConfig', () => {
  it('remove as chaves de API', () => {
    const pub = publicConfig(
      loadConfig({ GEMINI_API_KEY: 'segredo', SERPER_API_KEY: 'x', JINA_API_KEY: 'y' }),
    )
    expect(JSON.stringify(pub)).not.toMatch(/segredo/)
    expect(pub).not.toHaveProperty('geminiApiKey')
    expect(pub).not.toHaveProperty('serperApiKey')
    expect(pub).not.toHaveProperty('jinaApiKey')
  })
})
