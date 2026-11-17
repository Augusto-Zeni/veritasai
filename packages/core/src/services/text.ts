/**
 * Processamento de texto para a seleção de evidências (sem LLM):
 * limpeza de markdown, divisão em trechos e ranking lexical BM25.
 */

/** Remove a marcação markdown que o Jina devolve (links, imagens, títulos, ênfase). */
export function cleanMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // imagens
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → texto
    .replace(/<[^>]+>/g, ' ') // HTML solto
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '') // títulos
    .replace(/^[ \t]*[-*+][ \t]+/gm, '') // marcadores de lista
    .replace(/^[ \t]*>[ \t]?/gm, '') // citações
    .replace(/(\*\*|__|\*|_|`)/g, '') // ênfase e código
    .replace(/^[ \t]*[-=_*]{3,}[ \t]*$/gm, '') // linhas horizontais
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Corta o texto em até `maxChars`, preferindo o fim de um parágrafo ou de uma frase.
 */
export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false }
  const slice = text.slice(0, maxChars)
  const cut = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. ') + 1)
  return { text: (cut > maxChars * 0.7 ? slice.slice(0, cut) : slice).trim(), truncated: true }
}

/** Divide em frases sem quebrar em abreviações comuns e números (1.200, 3,5). */
export function splitSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((para) =>
      para
        .replace(/\b(Sr|Sra|Dr|Dra|Prof|Profa|art|inc|n|nº|p|pág|etc|Jr)\.\s/gi, '$1\uE000 ')
        .split(/(?<=[.!?…])\s+(?=["“(]?[A-ZÀ-Ú0-9])/)
        .map((s) => s.replace(/\uE000/g, '.').trim()),
    )
    .filter((s) => s.length > 0)
}

export interface PassageOptions {
  /** Tamanho máximo de cada trecho (padrão 600 caracteres). */
  maxChars?: number
  /** Trechos menores que isso são descartados (menus, legendas). Padrão 60. */
  minChars?: number
}

/**
 * Agrupa frases consecutivas em trechos de até `maxChars`, com sobreposição
 * de uma frase entre trechos vizinhos (para não perder contexto na fronteira).
 */
export function splitPassages(text: string, options: PassageOptions = {}): string[] {
  const { maxChars = 600, minChars = 60 } = options
  const sentences = splitSentences(text).map((s) =>
    s.length > maxChars ? s.slice(0, maxChars) : s,
  )
  const passages: string[] = []
  let i = 0
  while (i < sentences.length) {
    let passage = sentences[i]!
    let j = i + 1
    while (j < sentences.length && passage.length + 1 + sentences[j]!.length <= maxChars) {
      passage += ` ${sentences[j]!}`
      j++
    }
    if (passage.length >= minChars) passages.push(passage)
    if (j >= sentences.length) break
    i = j - i > 1 ? j - 1 : j // sobreposição de uma frase
  }
  return [...new Set(passages)]
}

const STOPWORDS = new Set(
  (
    'a o e é de do da dos das em no na nos nas um uma uns umas por para pelo pela pelos pelas com sem ' +
    'que se ao aos à às ou mas como mais menos muito muita muitos muitas já não sim foi ser são era eram ' +
    'está estão estava esse essa esses essas este esta estes estas isso isto aquele aquela aqueles ' +
    'seu sua seus suas ele ela eles elas lhe lhes nós vós você vocês eu tu me te há ter tem têm tinha ' +
    'também quando onde qual quais quem cujo cuja sobre entre até após desde contra segundo ainda só ' +
    'pode podem deve devem vai vão the of and to in'
  ).split(' '),
)

const stripAccents = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '')

/** Tokeniza para o ranking: minúsculas, sem acentos, sem stopwords, plural simples removido. */
export function tokenize(text: string): string[] {
  const tokens: string[] = []
  for (const raw of stripAccents(text.toLowerCase()).split(/[^\p{L}\p{N}]+/u)) {
    if (!raw || STOPWORDS.has(raw)) continue
    if (/^\p{N}+$/u.test(raw)) {
      tokens.push(raw)
      continue
    }
    if (raw.length < 3) continue
    tokens.push(raw.length > 4 && raw.endsWith('s') ? raw.slice(0, -1) : raw)
  }
  return tokens
}

export interface RankedPassage {
  index: number
  score: number
  /** Termos distintos da consulta encontrados no trecho. */
  matchedTerms: number
}

/** BM25 (k1 = 1.5, b = 0.75) dos documentos em relação à consulta. */
export function bm25Rank(query: string, documents: readonly string[]): RankedPassage[] {
  const k1 = 1.5
  const b = 0.75
  const queryTerms = [...new Set(tokenize(query))]
  const docs = documents.map(tokenize)
  const n = docs.length
  if (n === 0 || queryTerms.length === 0)
    return documents.map((_, index) => ({ index, score: 0, matchedTerms: 0 }))
  const avgLen = docs.reduce((sum, d) => sum + d.length, 0) / n || 1

  const df = new Map<string, number>()
  for (const term of queryTerms) df.set(term, docs.filter((d) => d.includes(term)).length)

  return docs.map((doc, index) => {
    const tf = new Map<string, number>()
    for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1)
    let score = 0
    let matchedTerms = 0
    for (const term of queryTerms) {
      const f = tf.get(term) ?? 0
      if (f === 0) continue
      matchedTerms++
      const d = df.get(term) ?? 0
      const idf = Math.log(1 + (n - d + 0.5) / (d + 0.5))
      score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * doc.length) / avgLen))
    }
    return { index, score, matchedTerms }
  })
}

/**
 * Relevância mínima: o trecho precisa conter pelo menos 2 termos distintos da afirmação
 * (ou 25% deles, o que for maior).
 */
export function minMatchedTerms(query: string): number {
  const terms = new Set(tokenize(query)).size
  return Math.min(terms, Math.max(2, Math.ceil(terms * 0.25)))
}
