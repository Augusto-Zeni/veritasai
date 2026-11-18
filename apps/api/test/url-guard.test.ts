import { describe, expect, it } from 'vitest'
import { checkNewsUrl } from '../src/url-guard.ts'

describe('checkNewsUrl', () => {
  it.each([
    'https://g1.globo.com/politica/noticia/2025/01/01/x.ghtml',
    'http://www.exemplo.com.br/noticia?utm_source=x',
    '  https://exemplo.com.br/a  ',
  ])('aceita %s', (url) => {
    expect(checkNewsUrl(url).ok).toBe(true)
  })

  it.each([
    ['nao é url', 'URL inválida'],
    ['ftp://exemplo.com.br/a', 'http'],
    ['javascript:alert(1)', 'http'],
    ['file:///etc/passwd', 'http'],
    ['https://user:senha@exemplo.com.br', 'usuário'],
    ['http://127.0.0.1/admin', 'IP'],
    ['http://10.0.0.5', 'IP'],
    ['http://[::1]:3000/', 'IP'],
    ['http://169.254.169.254/latest/meta-data', 'IP'],
    ['http://localhost:3000', 'rede local'],
    ['http://intranet/', 'rede local'],
    ['http://impressora.local/', 'rede local'],
    ['http://api.localhost/', 'rede local'],
    ['http://metadata.google.internal/', 'rede local'],
  ])('recusa %s', (url, reason) => {
    const r = checkNewsUrl(url)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain(reason)
  })
})
