import { describe, expect, it } from 'vitest'

// Regressão (2026-11-18): o jsdom 31 trazia um undici próprio que, ao ser carregado,
// trocava o dispatcher global usado pelo fetch nativo do Node — respostas brotli
// chegavam sem descompressão e redirecionamentos não eram seguidos.
describe('fetch global', () => {
  it('carregar os clients não instala um dispatcher global do undici', async () => {
    const symbols = [
      Symbol.for('undici.globalDispatcher.1'),
      Symbol.for('undici.globalDispatcher.2'),
    ]
    const before = symbols.map((s) => Reflect.get(globalThis, s))
    await import('../src/factory.ts')
    await import('../src/clients/readability.ts')
    expect(symbols.map((s) => Reflect.get(globalThis, s))).toEqual(before)
  })
})
