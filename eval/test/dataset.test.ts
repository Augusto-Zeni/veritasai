import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DATASET_COLUMNS, filterSplit, parseDataset } from '../src/dataset.ts'

const header = DATASET_COLUMNS.join(',')
const row = (
  id: string,
  overrides: Partial<Record<(typeof DATASET_COLUMNS)[number], string>> = {},
) => {
  const values = {
    id,
    url: `https://site.com.br/${id}`,
    titulo: `Título ${id}`,
    data_publicacao: '2025-03-01',
    tema: 'saúde',
    agencia: 'Lupa',
    url_checagem: `https://lupa.uol.com.br/${id}`,
    rotulo_agencia: 'Falso',
    rotulo_mapeado: 'FALSO',
    split: 'teste',
    ...overrides,
  }
  return DATASET_COLUMNS.map((c) => values[c]).join(',')
}

describe('parseDataset — coluna texto', () => {
  const headerTexto = `${header},texto`
  const texto =
    'Post afirma que o governo vai confiscar a poupança de todos os brasileiros em 2026.'
  it('aceita linha só com texto e gera uma origem fictícia única', () => {
    const ds = parseDataset(
      [
        headerTexto,
        `${row('N1', { url: '' })},${texto}`,
        `${row('N2', { url: '' })},${texto} De novo.`,
        `${row('N3')},`,
      ].join('\n'),
    )
    expect(ds.rows.map((r) => r.url)).toEqual([
      'https://texto.invalid/N1',
      'https://texto.invalid/N2',
      'https://site.com.br/N3',
    ])
    expect(ds.rows[0]!.texto).toBe(texto)
    expect(ds.rows[2]!.texto).toBe('')
  })
  it('exige url ou texto e avisa sobre texto curto', () => {
    expect(() => parseDataset([headerTexto, `${row('N1', { url: '' })},`].join('\n'))).toThrow(
      /url ou texto/,
    )
    const ds = parseDataset([headerTexto, `${row('N1', { url: '' })},curto`].join('\n'))
    expect(ds.warnings.join()).toMatch(/texto muito curto/)
  })
  it('continua aceitando CSV sem a coluna texto', () => {
    expect(parseDataset([header, row('N1')].join('\n')).rows[0]!.texto).toBe('')
  })
})

describe('parseDataset', () => {
  it('lê e valida as linhas; normaliza o rótulo para maiúsculas', () => {
    const ds = parseDataset(
      [header, row('N1'), row('N2', { rotulo_mapeado: 'impreciso', split: 'calibracao' })].join(
        '\n',
      ),
    )
    expect(ds.rows).toHaveLength(2)
    expect(ds.rows[1]!.rotulo_mapeado).toBe('IMPRECISO')
    expect(ds.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(filterSplit(ds.rows, 'calibracao').map((r) => r.id)).toEqual(['N2'])
    expect(filterSplit(ds.rows, 'todos')).toHaveLength(2)
  })

  it('rejeita rótulo inválido, split inválido, id e url repetidos', () => {
    expect(() =>
      parseDataset([header, row('N1', { rotulo_mapeado: 'TALVEZ' })].join('\n')),
    ).toThrow(/linha 2/)
    expect(() => parseDataset([header, row('N1', { split: 'treino' })].join('\n'))).toThrow(
      /Dataset inválido/,
    )
    expect(() => parseDataset([header, row('N1'), row('N1')].join('\n'))).toThrow(/id repetido/)
    expect(() =>
      parseDataset([header, row('N1'), row('N2', { url: 'https://site.com.br/N1' })].join('\n')),
    ).toThrow(/url repetida/)
  })

  it('rejeita cabeçalho incompleto', () => {
    expect(() => parseDataset('id,url\nN1,https://x.com')).toThrow(/sem as colunas/)
  })

  it('avisa quando a url aponta para a agência de checagem', () => {
    const ds = parseDataset(
      [header, row('N1', { url: 'https://www.aosfatos.org/noticias/x' })].join('\n'),
    )
    expect(ds.warnings[0]).toMatch(/N1: a coluna url aponta para uma agência/)
  })

  it('o noticias.csv do repositório tem o cabeçalho correto', () => {
    const text = readFileSync(join(import.meta.dirname, '..', 'dataset', 'noticias.csv'), 'utf8')
    expect(() => parseDataset(text)).not.toThrow()
  })
})
