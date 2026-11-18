/**
 * CSV (RFC 4180) sem dependências: campos entre aspas, aspas escapadas ("")
 * e quebras de linha dentro de campos. Separador vírgula, UTF-8 (com ou sem BOM).
 */

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
      continue
    }
    if (ch === '"' && field === '') inQuotes = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (inQuotes) throw new Error('CSV inválido: aspas não fechadas')
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Ignora linhas totalmente vazias.
  return rows.filter((r) => r.some((f) => f.trim() !== ''))
}

/** Converte em objetos usando a primeira linha como cabeçalho. */
export function parseCsvObjects(text: string): Array<Record<string, string>> {
  const [header, ...rows] = parseCsv(text)
  if (!header) return []
  const keys = header.map((h) => h.trim())
  return rows.map((r, i) => {
    if (r.length !== keys.length) {
      throw new Error(
        `CSV inválido: linha ${i + 2} tem ${r.length} colunas, cabeçalho tem ${keys.length}`,
      )
    }
    return Object.fromEntries(keys.map((k, j) => [k, r[j]!]))
  })
}

function escapeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function stringifyCsv(
  header: readonly string[],
  rows: ReadonlyArray<Record<string, string | number>>,
): string {
  const lines = [header.map(escapeField).join(',')]
  for (const row of rows) lines.push(header.map((h) => escapeField(String(row[h] ?? ''))).join(','))
  return `${lines.join('\n')}\n`
}
