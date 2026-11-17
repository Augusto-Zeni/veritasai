import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FetchFn } from '../src/utils/http.ts'

export function fixture(path: string): string {
  return readFileSync(join(import.meta.dirname, 'fixtures', path), 'utf8')
}

export function fixtureJson(path: string): unknown {
  return JSON.parse(fixture(path))
}

export interface RecordedRequest {
  url: string
  init: RequestInit | undefined
}

/** `fetch` falso: devolve as respostas na ordem e grava as requisições. */
export function fakeFetch(
  responses: Array<Response | Error>,
): FetchFn & { calls: RecordedRequest[] } {
  const calls: RecordedRequest[] = []
  const fn = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init })
    const next = responses.shift()
    if (!next) throw new Error('fakeFetch: nenhuma resposta restante')
    if (next instanceof Error) throw next
    return next
  }
  return Object.assign(fn, { calls })
}

export const jsonResponse = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })

export const htmlResponse = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })

/** Sem espera nos testes de retry. */
export const noSleep = async (): Promise<void> => {}
export const fastRetry = { sleep: noSleep, random: () => 0 }
