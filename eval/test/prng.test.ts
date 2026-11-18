import { describe, expect, it } from 'vitest'
import { mulberry32, sampleWithSeed } from '../src/prng.ts'

describe('prng', () => {
  it('mesma semente → mesma sequência; sementes diferentes → sequências diferentes', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(seqA)
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true)
    expect(mulberry32(43)()).not.toBe(seqA[0])
  })

  it('amostra sem repetição, reproduzível e sem alterar a lista original', () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    const s1 = sampleWithSeed(items, 10, 42)
    expect(sampleWithSeed(items, 10, 42)).toEqual(s1)
    expect(new Set(s1).size).toBe(10)
    expect(items).toEqual(Array.from({ length: 50 }, (_, i) => i))
    expect(sampleWithSeed(items, 100, 1)).toHaveLength(50)
  })
})
