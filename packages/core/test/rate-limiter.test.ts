import { describe, expect, it } from 'vitest'
import { LlmQuotaError } from '../src/errors.ts'
import { RateLimiter } from '../src/utils/rate-limiter.ts'

/** Relógio falso: `sleep` só avança o tempo. */
function fakeClock(start = 0) {
  let t = start
  const sleeps: number[] = []
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms)
      t += ms
    },
    advance: (ms: number) => void (t += ms),
    sleeps,
  }
}

describe('RateLimiter', () => {
  it('espera a janela de 1 minuto quando o RPM é atingido', async () => {
    const clock = fakeClock()
    const limiter = new RateLimiter({ rpm: 2, rpd: 100, now: clock.now, sleep: clock.sleep })
    const times: number[] = []
    const task = () => limiter.schedule(async () => void times.push(clock.now()))
    await Promise.all([task(), task(), task()])
    expect(times).toEqual([0, 0, 60_000])
    expect(clock.sleeps).toEqual([60_000])
  })

  it('libera assim que a chamada mais antiga sai da janela', async () => {
    const clock = fakeClock()
    const limiter = new RateLimiter({ rpm: 2, rpd: 100, now: clock.now, sleep: clock.sleep })
    await limiter.schedule(async () => {})
    clock.advance(40_000)
    await limiter.schedule(async () => {})
    await limiter.schedule(async () => {})
    expect(clock.sleeps).toEqual([20_000])
  })

  it('falha com LlmQuotaError ao atingir o RPD, sem chamar a função', async () => {
    const clock = fakeClock()
    const limiter = new RateLimiter({ rpm: 100, rpd: 2, now: clock.now, sleep: clock.sleep })
    let calls = 0
    const task = () => limiter.schedule(async () => void calls++)
    await task()
    await task()
    await expect(task()).rejects.toBeInstanceOf(LlmQuotaError)
    expect(calls).toBe(2)
    expect(limiter.usedToday).toBe(2)
    clock.advance(24 * 60 * 60 * 1000)
    await task()
    expect(calls).toBe(3)
  })

  it('respeita a concorrência', async () => {
    const limiter = new RateLimiter({ rpm: 100, rpd: 100, concurrency: 2 })
    let running = 0
    let max = 0
    const task = () =>
      limiter.schedule(async () => {
        running++
        max = Math.max(max, running)
        await new Promise((r) => setTimeout(r, 5))
        running--
      })
    await Promise.all([task(), task(), task(), task()])
    expect(max).toBe(2)
  })
})
