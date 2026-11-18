import { describe, expect, it } from 'vitest'
import { parseCsv, parseCsvObjects, stringifyCsv } from '../src/csv.ts'

describe('csv', () => {
  it('lê aspas, aspas escapadas, vírgulas e quebras de linha dentro de campos, BOM e CRLF', () => {
    const text = '\uFEFFa,b,c\r\n1,"dois, com vírgula","linha 1\nlinha 2"\r\n"x ""y""",,z\r\n\r\n'
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['1', 'dois, com vírgula', 'linha 1\nlinha 2'],
      ['x "y"', '', 'z'],
    ])
  })

  it('converte em objetos e acusa número de colunas errado', () => {
    expect(parseCsvObjects('id,nome\n1,Ana\n')).toEqual([{ id: '1', nome: 'Ana' }])
    expect(() => parseCsvObjects('id,nome\n1\n')).toThrow(/linha 2/)
    expect(() => parseCsv('"aberto')).toThrow(/aspas/)
  })

  it('ida e volta preserva o conteúdo', () => {
    const rows = [
      { a: 'texto, com "aspas"', b: 'multi\nlinha' },
      { a: 3, b: '' },
    ]
    expect(parseCsvObjects(stringifyCsv(['a', 'b'], rows))).toEqual([
      { a: 'texto, com "aspas"', b: 'multi\nlinha' },
      { a: '3', b: '' },
    ])
  })
})
