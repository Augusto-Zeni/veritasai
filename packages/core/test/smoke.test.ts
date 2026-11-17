import { describe, expect, it } from 'vitest'
import { VERSION } from '../src/index.ts'

describe('core', () => {
  it('exporta a versão', () => {
    expect(VERSION).toBe('0.0.0')
  })
})
