import { describe, expect, it } from 'vitest'
import {
  bm25Rank,
  cleanMarkdown,
  minMatchedTerms,
  splitPassages,
  splitSentences,
  tokenize,
  truncateText,
} from '../src/services/text.ts'

describe('cleanMarkdown', () => {
  it('remove links, imagens, títulos e ênfase', () => {
    const md =
      '# Título\n\n![foto](x.jpg)\nVeja [a nota oficial](https://gov.br) e **leia** _mais_.\n\n- item\n\n---'
    expect(cleanMarkdown(md)).toBe('Título\n\nVeja a nota oficial e leia mais.\n\nitem')
  })
})

describe('truncateText', () => {
  it('não mexe em texto curto', () => {
    expect(truncateText('abc', 10)).toEqual({ text: 'abc', truncated: false })
  })

  it('corta no fim de frase quando possível', () => {
    const text = 'Primeira frase completa aqui. Segunda frase que será cortada no meio'
    expect(truncateText(text, 40)).toEqual({
      text: 'Primeira frase completa aqui.',
      truncated: true,
    })
  })
})

describe('splitSentences', () => {
  it('não quebra em abreviações nem em números', () => {
    expect(
      splitSentences(
        'O Dr. Silva disse que 1.200 pessoas foram vacinadas. A taxa foi de 3,5%. Fim!',
      ),
    ).toEqual([
      'O Dr. Silva disse que 1.200 pessoas foram vacinadas.',
      'A taxa foi de 3,5%.',
      'Fim!',
    ])
  })
})

describe('splitPassages', () => {
  it('agrupa frases até o limite, com sobreposição de uma frase', () => {
    const s = (n: number) => `Frase número ${n} com algum conteúdo relevante.`
    const text = [1, 2, 3, 4, 5].map(s).join(' ')
    const passages = splitPassages(text, { maxChars: 100, minChars: 10 })
    expect(passages[0]).toBe(`${s(1)} ${s(2)}`)
    expect(passages[1]).toBe(`${s(2)} ${s(3)}`)
    expect(passages.every((p) => p.length <= 100)).toBe(true)
    expect(passages.at(-1)).toContain(s(5))
  })

  it('descarta trechos curtos demais (menus)', () => {
    expect(splitPassages('Início\nSaúde\nAssine', { minChars: 20 })).toEqual([])
  })
})

describe('tokenize', () => {
  it('remove acentos, stopwords e plural simples; mantém números', () => {
    expect(tokenize('As vacinações da dengue em 2024 nos Estados')).toEqual([
      'vacinacoe',
      'dengue',
      '2024',
      'estado',
    ])
  })
})

describe('bm25Rank', () => {
  it('ranqueia o trecho relevante acima dos irrelevantes', () => {
    const docs = [
      'O campeonato de futebol terminou com vitória do time visitante.',
      'O Ministério da Saúde vai distribuir 1,2 milhão de doses da vacina contra a dengue até março.',
      'A previsão do tempo indica chuva para o fim de semana em São Paulo.',
    ]
    const ranked = bm25Rank(
      'Ministério da Saúde distribuirá 1,2 milhão de doses da vacina da dengue',
      docs,
    )
    const best = [...ranked].sort((a, b) => b.score - a.score)[0]!
    expect(best.index).toBe(1)
    expect(best.matchedTerms).toBeGreaterThanOrEqual(5)
    expect(ranked[0]!.score).toBe(0)
  })

  it('lida com lista vazia e consulta só de stopwords', () => {
    expect(bm25Rank('dengue', [])).toEqual([])
    expect(bm25Rank('de a o', ['texto'])).toEqual([{ index: 0, score: 0, matchedTerms: 0 }])
  })
})

describe('minMatchedTerms', () => {
  it('exige ao menos 2 termos ou 25%, sem passar do total', () => {
    expect(minMatchedTerms('dengue')).toBe(1)
    expect(minMatchedTerms('vacina dengue')).toBe(2)
    expect(minMatchedTerms('um dois três quatro cinco seis sete oito nove dez onze doze')).toBe(3)
  })
})
