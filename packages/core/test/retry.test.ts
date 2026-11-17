import { describe, expect, it, vi } from 'vitest'
import { LlmError, LlmQuotaError, SearchError } from '../src/errors.ts'
import { withRetry } from '../src/utils/retry.ts'

describe('withRetry', () => {
  it('tenta de novo erros retryable com backoff exponencial', async () => {
    const delays: number[] = []
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new SearchError('503', { retryable: true }))
      .mockRejectedValueOnce(new SearchError('503', { retryable: true }))
      .mockResolvedValue('ok')
    const result = await withRetry(fn, {
      baseDelayMs: 100,
      random: () => 1, // sem jitter
      sleep: async (ms) => void delays.push(ms),
    })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
    expect(delays).toEqual([100, 200])
  })

  it('não tenta de novo erros não retryable', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new LlmError('400', { retryable: false }))
    await expect(withRetry(fn, { sleep: async () => {} })).rejects.toThrow('400')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('desiste após o número máximo de tentativas', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new SearchError('503', { retryable: true }))
    await expect(withRetry(fn, { retries: 2, sleep: async () => {} })).rejects.toBeInstanceOf(
      SearchError,
    )
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('respeita retryAfterMs sugerido pelo servidor (limitado a maxDelayMs)', async () => {
    const delays: number[] = []
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new LlmQuotaError('429', { retryable: true, retryAfterMs: 30_000 }))
      .mockRejectedValueOnce(new LlmQuotaError('429', { retryable: true, retryAfterMs: 999_000 }))
      .mockResolvedValue('ok')
    await withRetry(fn, {
      baseDelayMs: 100,
      random: () => 1,
      sleep: async (ms) => void delays.push(ms),
    })
    expect(delays).toEqual([30_000, 60_000])
  })
})
