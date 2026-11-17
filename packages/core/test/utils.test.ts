import { describe, expect, it } from 'vitest'
import { parseRetryAfter } from '../src/errors.ts'
import { stableHash, stableStringify } from '../src/utils/hash.ts'
import { domainOf, matchesAnyDomain, matchesDomain, normalizeUrl } from '../src/utils/url.ts'

describe('normalizeUrl', () => {
  it('remove utm_*, rastreadores, fragmento, www e barra final; ordena a query', () => {
    expect(
      normalizeUrl(
        'https://WWW.Exemplo.com.br/noticia/?utm_source=x&b=2&fbclid=abc&a=1&UTM_Medium=y#comentarios',
      ),
    ).toBe('https://exemplo.com.br/noticia?a=1&b=2')
  })

  it('mantém a raiz e parâmetros legítimos', () => {
    expect(normalizeUrl('https://exemplo.com.br/')).toBe('https://exemplo.com.br/')
    expect(normalizeUrl('https://exemplo.com.br/busca?q=dengue')).toBe(
      'https://exemplo.com.br/busca?q=dengue',
    )
  })

  it('rejeita URL inválida', () => {
    expect(() => normalizeUrl('não é url')).toThrow()
  })
})

describe('matchesDomain', () => {
  it('casa host exato e subdomínios, mas não sufixos parciais', () => {
    expect(matchesDomain('https://www.aosfatos.org/x', 'aosfatos.org')).toBe(true)
    expect(matchesDomain('https://checagem.aosfatos.org/x', 'aosfatos.org')).toBe(true)
    expect(matchesDomain('https://naoaosfatos.org/x', 'aosfatos.org')).toBe(false)
  })

  it('padrão com caminho casa só aquela seção do site', () => {
    const p = 'estadao.com.br/estadao-verifica'
    expect(matchesDomain('https://www.estadao.com.br/estadao-verifica/abc/', p)).toBe(true)
    expect(matchesDomain('https://www.estadao.com.br/estadao-verifica', p)).toBe(true)
    expect(matchesDomain('https://www.estadao.com.br/saude/abc', p)).toBe(false)
    expect(matchesDomain('https://www.estadao.com.br/estadao-verificacao', p)).toBe(false)
  })

  it('URL inválida não casa', () => {
    expect(matchesDomain('xyz', 'aosfatos.org')).toBe(false)
    expect(matchesAnyDomain('https://lupa.uol.com.br/a', ['aosfatos.org', 'lupa.uol.com.br'])).toBe(
      true,
    )
  })

  it('domainOf remove www', () => {
    expect(domainOf('https://www.gov.br/saude')).toBe('gov.br')
  })
})

describe('stableHash', () => {
  it('não depende da ordem das chaves', () => {
    expect(stableHash({ a: 1, b: { c: 2, d: 3 } })).toBe(stableHash({ b: { d: 3, c: 2 }, a: 1 }))
    expect(stableStringify({ b: 1, a: [2, { z: 1, y: 2 }] })).toBe('{"a":[2,{"y":2,"z":1}],"b":1}')
  })

  it('muda quando o conteúdo muda', () => {
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }))
  })
})

describe('parseRetryAfter', () => {
  it('lê segundos e datas HTTP', () => {
    expect(parseRetryAfter('30')).toBe(30_000)
    const now = Date.parse('2026-11-17T12:00:00Z')
    expect(parseRetryAfter('Tue, 17 Nov 2026 12:00:10 GMT', now)).toBe(10_000)
    expect(parseRetryAfter(null)).toBeUndefined()
    expect(parseRetryAfter('lixo')).toBeUndefined()
  })
})
