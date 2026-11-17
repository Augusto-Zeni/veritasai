import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'

describe('GET /health', () => {
  it('responde ok', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok' })
    await app.close()
  })
})
