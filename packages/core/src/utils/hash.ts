import { createHash } from 'node:crypto'

/** JSON com chaves ordenadas: o mesmo objeto sempre gera a mesma string. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>
      return Object.fromEntries(
        Object.keys(obj)
          .sort()
          .map((k) => [k, obj[k]]),
      )
    }
    return v
  })
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/** Hash estável de qualquer valor serializável (chave de cache). */
export function stableHash(value: unknown): string {
  return sha256(stableStringify(value))
}
