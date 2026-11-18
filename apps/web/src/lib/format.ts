/** Textos da interface derivados dos resultados (funções puras). */
import type { ClaimLabel, NewsVerdict, RunMeta } from '@veritasai/core/domain'
import type { PipelineStage } from './api.ts'

export const VERDICT_TEXT: Record<NewsVerdict, { label: string; summary: string }> = {
  VERDADEIRO: {
    label: 'Verdadeiro',
    summary: 'As evidências encontradas confirmam a maior parte das afirmações da notícia.',
  },
  FALSO: {
    label: 'Falso',
    summary: 'As evidências encontradas contradizem a maior parte das afirmações da notícia.',
  },
  IMPRECISO: {
    label: 'Impreciso',
    summary:
      'As evidências são mistas ou não bastam para um veredito claro. Leia as afirmações abaixo.',
  },
}

export const LABEL_TEXT: Record<ClaimLabel, { label: string; plural: string; hint: string }> = {
  SUPORTADA: {
    label: 'Suportada',
    plural: 'Suportadas',
    hint: 'As evidências confirmam esta afirmação.',
  },
  CONTRADITA: {
    label: 'Contradita',
    plural: 'Contraditas',
    hint: 'As evidências contradizem esta afirmação.',
  },
  INSUFICIENTE: {
    label: 'Sem evidência suficiente',
    plural: 'Sem evidência',
    hint: 'Não foram encontradas evidências suficientes para confirmar ou contradizer.',
  },
}

export const STAGE_TEXT: Record<PipelineStage, { label: string; detail: string }> = {
  scrape: { label: 'Lendo a notícia', detail: 'Extraindo o texto da página' },
  claims: { label: 'Identificando afirmações', detail: 'Separando o texto em fatos verificáveis' },
  queries: { label: 'Preparando as buscas', detail: 'Criando uma consulta para cada afirmação' },
  evidence: {
    label: 'Buscando evidências e classificando',
    detail: 'Lendo fontes públicas para cada afirmação',
  },
  scoring: { label: 'Calculando o veredito', detail: 'Combinando os resultados das afirmações' },
}

export interface LabelCounts {
  SUPORTADA: number
  CONTRADITA: number
  INSUFICIENTE: number
}

export function countLabels(labels: readonly ClaimLabel[]): LabelCounts {
  const counts: LabelCounts = { SUPORTADA: 0, CONTRADITA: 0, INSUFICIENTE: 0 }
  for (const l of labels) counts[l]++
  return counts
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** "7 de 9 afirmações tiveram evidências". */
export function coverageText(counts: LabelCounts): string {
  const total = counts.SUPORTADA + counts.CONTRADITA + counts.INSUFICIENTE
  const decided = counts.SUPORTADA + counts.CONTRADITA
  if (total === 0) return 'Nenhuma afirmação verificável foi encontrada'
  if (total === 1) {
    return decided === 1
      ? 'A única afirmação teve evidências'
      : 'A única afirmação não teve evidências suficientes'
  }
  return `${decided} de ${total} afirmações ${plural(decided, 'teve', 'tiveram')} evidências`
}

/** Leitura em linguagem simples do score s ∈ [-1, 1]. */
export function scoreText(score: number | null, counts: LabelCounts): string {
  if (score === null) return 'Nenhuma afirmação teve evidência suficiente para comparar'
  const s = counts.SUPORTADA
  const c = counts.CONTRADITA
  const sup = `${s} ${plural(s, 'confirmada', 'confirmadas')}`
  const con = `${c} ${plural(c, 'contradita', 'contraditas')}`
  if (score > 0) return `As evidências mais confirmam do que contradizem (${sup}, ${con})`
  if (score < 0) return `As evidências mais contradizem do que confirmam (${sup}, ${con})`
  return `As evidências estão divididas (${sup}, ${con})`
}

export interface Thresholds {
  coverageMin: number
  trueMin: number
  falseMax: number
}

/** Limiares usados no resultado (ficam em meta.config.scoring). */
export function thresholdsOf(meta: RunMeta): Thresholds | null {
  const scoring = (meta.config as { scoring?: unknown }).scoring
  if (typeof scoring !== 'object' || scoring === null) return null
  const t = scoring as Record<string, unknown>
  const { coverageMin, trueMin, falseMax } = t
  if (
    typeof coverageMin !== 'number' ||
    typeof trueMin !== 'number' ||
    typeof falseMax !== 'number'
  )
    return null
  return { coverageMin, trueMin, falseMax }
}

/** Valida a URL digitada antes de enviar (a API valida de novo). */
export function validateUrlInput(
  raw: string,
): { ok: true; url: string } | { ok: false; message: string } {
  const value = raw.trim()
  if (!value) return { ok: false, message: 'Cole o link de uma notícia.' }
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return { ok: false, message: 'Isso não parece um link válido.' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, message: 'O link precisa começar com http:// ou https://' }
  }
  if (!url.hostname.includes('.')) return { ok: false, message: 'Isso não parece um link válido.' }
  return { ok: true, url: url.toString() }
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`
}

export function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR')
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
