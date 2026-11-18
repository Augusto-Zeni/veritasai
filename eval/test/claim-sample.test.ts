import { describe, expect, it } from 'vitest'
import { normalizeManualLabel, sampleClaims } from '../src/claim-sample.ts'
import { record } from './fixtures.ts'

const records = [
  record('N2', 'FALSO', 'FALSO', ['CONTRADITA', 'INSUFICIENTE']),
  record('N1', 'VERDADEIRO', 'VERDADEIRO', ['SUPORTADA', 'SUPORTADA', 'SUPORTADA']),
]

describe('sampleClaims', () => {
  it('é reproduzível e não depende da ordem dos registros', () => {
    const a = sampleClaims(records, 3, 42)
    const b = sampleClaims([...records].reverse(), 3, 42)
    expect(a).toEqual(b)
    expect(a.map((s) => s.manual.amostra_id)).toEqual(['A001', 'A002', 'A003'])
  })

  it('separa o rótulo do sistema do arquivo de rotulação (rotulação cega)', () => {
    const [s] = sampleClaims(records, 1, 7)
    expect(s!.manual).not.toHaveProperty('rotulo_sistema')
    expect(s!.manual.rotulo_manual).toBe('')
    expect(s!.manual.evidencias).toContain('https://gov.br/x')
    expect(s!.system.amostra_id).toBe(s!.manual.amostra_id)
    expect(['SUPORTADA', 'CONTRADITA', 'INSUFICIENTE']).toContain(s!.system.rotulo_sistema)
  })

  it('n maior que o total devolve todas as afirmações', () => {
    expect(sampleClaims(records, 100, 1)).toHaveLength(5)
  })
})

describe('normalizeManualLabel', () => {
  it('aceita rótulo completo, abreviação, minúsculas e sem acento; vazio = não rotulado', () => {
    expect(normalizeManualLabel('suportada')).toBe('SUPORTADA')
    expect(normalizeManualLabel(' c ')).toBe('CONTRADITA')
    expect(normalizeManualLabel('I')).toBe('INSUFICIENTE')
    expect(normalizeManualLabel('')).toBeNull()
    expect(() => normalizeManualLabel('talvez')).toThrow(/inválido/)
  })
})
