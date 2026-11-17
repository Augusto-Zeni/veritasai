/** Parâmetros de rastreamento removidos na normalização. */
const TRACKING_PARAMS = new Set(['fbclid', 'gclid', 'mc_cid', 'mc_eid', 'igshid', 'ref_src'])

/**
 * Normaliza a URL para usar como chave de cache: remove `utm_*` e outros
 * parâmetros de rastreamento, o fragmento, `www.` e a barra final; ordena a query.
 */
export function normalizeUrl(raw: string): string {
  const url = new URL(raw.trim())
  url.hash = ''
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key)
    }
  }
  url.searchParams.sort()
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }
  return url.toString()
}

/** Domínio (host sem `www.`) de uma URL. */
export function domainOf(raw: string): string {
  return new URL(raw).hostname.toLowerCase().replace(/^www\./, '')
}

/**
 * Verifica se a URL pertence a um padrão de domínio. O padrão pode ser só o host
 * (`aosfatos.org`, casa também subdomínios) ou host + caminho (`estadao.com.br/estadao-verifica`).
 */
export function matchesDomain(rawUrl: string, pattern: string): boolean {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const [patternHost = '', ...rest] = pattern
    .toLowerCase()
    .replace(/^www\./, '')
    .split('/')
  const hostMatches = host === patternHost || host.endsWith(`.${patternHost}`)
  if (!hostMatches) return false
  if (rest.length === 0) return true
  const patternPath = `/${rest.join('/')}`.replace(/\/+$/, '')
  const path = url.pathname.toLowerCase()
  return path === patternPath || path.startsWith(`${patternPath}/`)
}

export function matchesAnyDomain(rawUrl: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => matchesDomain(rawUrl, p))
}
