import { readFileSync } from 'node:fs'
import { FACTCHECK_DOMAINS, matchesAnyDomain, NewsVerdictSchema, sha256 } from '@veritasai/core'
import { z } from 'zod'
import { parseCsvObjects } from './csv.ts'

export const SPLITS = ['calibracao', 'teste'] as const
export type Split = (typeof SPLITS)[number]

export const DATASET_COLUMNS = [
  'id',
  'url',
  'titulo',
  'data_publicacao',
  'tema',
  'agencia',
  'url_checagem',
  'rotulo_agencia',
  'rotulo_mapeado',
  'split',
] as const

export const DatasetRowSchema = z.object({
  id: z.string().trim().min(1),
  url: z.string().trim().url(),
  titulo: z.string().trim(),
  data_publicacao: z.string().trim(),
  tema: z.string().trim(),
  agencia: z.string().trim(),
  url_checagem: z.string().trim().url(),
  rotulo_agencia: z.string().trim(),
  rotulo_mapeado: z.string().trim().toUpperCase().pipe(NewsVerdictSchema),
  split: z.enum(SPLITS),
})
export type DatasetRow = z.infer<typeof DatasetRowSchema>

export interface Dataset {
  rows: DatasetRow[]
  /** sha256 do arquivo (vai para o config.json da execução). */
  hash: string
  /** Problemas que não impedem a execução, mas devem ser revistos. */
  warnings: string[]
}

export function parseDataset(text: string): Dataset {
  const raw = parseCsvObjects(text)
  const header = raw[0] ? Object.keys(raw[0]) : [...DATASET_COLUMNS]
  const missing = DATASET_COLUMNS.filter((c) => !header.includes(c))
  if (missing.length > 0) throw new Error(`Dataset sem as colunas: ${missing.join(', ')}`)

  const rows: DatasetRow[] = []
  const errors: string[] = []
  raw.forEach((r, i) => {
    const parsed = DatasetRowSchema.safeParse(r)
    if (parsed.success) rows.push(parsed.data)
    else
      errors.push(
        `linha ${i + 2} (id=${r.id ?? '?'}): ${z.prettifyError(parsed.error).replace(/\n/g, '; ')}`,
      )
  })

  const seenIds = new Set<string>()
  const seenUrls = new Set<string>()
  for (const row of rows) {
    if (seenIds.has(row.id)) errors.push(`id repetido: ${row.id}`)
    if (seenUrls.has(row.url)) errors.push(`url repetida: ${row.url} (id=${row.id})`)
    seenIds.add(row.id)
    seenUrls.add(row.url)
  }
  if (errors.length > 0) throw new Error(`Dataset inválido:\n- ${errors.join('\n- ')}`)

  const warnings: string[] = []
  for (const row of rows) {
    if (matchesAnyDomain(row.url, FACTCHECK_DOMAINS)) {
      warnings.push(
        `${row.id}: a coluna url aponta para uma agência de checagem; deveria ser a notícia original`,
      )
    }
  }
  return { rows, hash: sha256(text), warnings }
}

export function loadDataset(path: string): Dataset {
  return parseDataset(readFileSync(path, 'utf8'))
}

export function filterSplit(rows: readonly DatasetRow[], split: Split | 'todos'): DatasetRow[] {
  return split === 'todos' ? [...rows] : rows.filter((r) => r.split === split)
}
