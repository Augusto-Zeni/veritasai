import type { ScoringThresholds } from '../config.ts'
import type { ScoreResult } from './scoring.ts'

const plural = (n: number, singular: string, pluralForm: string) =>
  `${n} ${n === 1 ? singular : pluralForm}`

/** "7 de 9 afirmações tiveram evidências" (texto da tela de resultado). */
export function coverageSentence({ counts }: Pick<ScoreResult, 'counts'>): string {
  const decided = counts.supported + counts.contradicted
  const verb = decided === 1 ? 'teve' : 'tiveram'
  return `${decided} de ${plural(counts.total, 'afirmação', 'afirmações')} ${verb} evidências suficientes para uma conclusão`
}

/**
 * Explicação do veredito em linguagem simples, gerada a partir das contagens
 * (sem LLM: não há risco de a explicação contradizer o veredito).
 */
export function buildExplanation(score: ScoreResult, thresholds: ScoringThresholds): string {
  const { counts, verdict, coverage } = score
  if (counts.total === 0) {
    return 'Não foi possível extrair afirmações verificáveis desta notícia, por isso ela foi classificada como imprecisa.'
  }

  const parts = [
    (counts.total === 1
      ? 'Da única afirmação verificada, '
      : `Das ${counts.total} afirmações verificadas, `) +
      `${plural(counts.supported, 'foi confirmada', 'foram confirmadas')} pelas evidências, ` +
      `${plural(counts.contradicted, 'foi contradita', 'foram contraditas')} e ` +
      `${plural(counts.insufficient, 'não teve', 'não tiveram')} evidências suficientes.`,
  ]

  if (verdict === 'VERDADEIRO') {
    parts.push(
      'Como a maior parte das afirmações verificáveis foi confirmada, a notícia foi classificada como verdadeira.',
    )
  } else if (verdict === 'FALSO') {
    parts.push(
      'Como a maior parte das afirmações verificáveis foi contradita, a notícia foi classificada como falsa.',
    )
  } else if (coverage < thresholds.coverageMin) {
    const pct = Math.round(thresholds.coverageMin * 100)
    parts.push(
      `Menos de ${pct}% das afirmações tiveram evidências suficientes, então não há base para uma conclusão: a notícia foi classificada como imprecisa.`,
    )
  } else {
    parts.push(
      'As evidências confirmam parte das afirmações e contradizem outra parte, então a notícia foi classificada como imprecisa.',
    )
  }
  return parts.join(' ')
}
