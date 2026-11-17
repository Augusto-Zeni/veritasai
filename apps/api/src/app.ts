import Fastify, { type FastifyInstance } from 'fastify'
import { VERSION } from '@veritasai/core'

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })

  app.get('/health', () => ({ status: 'ok', version: VERSION }))

  return app
}
