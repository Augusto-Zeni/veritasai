import { isIP } from 'node:net'

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa']

/**
 * Aceita só URLs públicas de notícia: http(s), com domínio (não IP), sem credenciais e
 * sem hosts de rede local. Evita que a API seja usada para acessar a rede interna
 * do servidor (SSRF) pelo fallback do Readability, que baixa a página localmente.
 *
 * Limitação: não resolve DNS, então um domínio público que aponte para IP privado passa.
 */
export function checkNewsUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { ok: false, reason: 'URL inválida' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'A URL precisa começar com http:// ou https://' }
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'A URL não pode conter usuário ou senha' }
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (isIP(host) !== 0) {
    return { ok: false, reason: 'Informe o endereço do site (domínio), não um IP' }
  }
  if (
    host === 'localhost' ||
    !host.includes('.') ||
    BLOCKED_SUFFIXES.some((s) => host.endsWith(s))
  ) {
    return { ok: false, reason: 'Endereço de rede local não é permitido' }
  }
  return { ok: true, url }
}
