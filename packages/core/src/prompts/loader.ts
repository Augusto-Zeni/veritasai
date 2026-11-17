/**
 * Prompts versionados em arquivos .md:
 *
 *   ---
 *   id: claim-extraction
 *   version: 1
 *   ---
 *   <system>
 *   ...instruções...
 *   </system>
 *   <user>
 *   ...modelo com {{variaveis}}...
 *   </user>
 *
 * Qualquer alteração no texto exige incrementar `version`; a versão vai para o `meta`
 * de cada resultado e entra na chave do cache do LLM.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface PromptTemplate {
  id: string
  version: string
  system: string
  user: string
}

export interface RenderedPrompt {
  promptId: string
  promptVersion: string
  system: string
  prompt: string
}

const PROMPTS_DIR = import.meta.dirname

export function parsePrompt(source: string, file = '<inline>'): PromptTemplate {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source)
  if (!fm) throw new Error(`Prompt ${file}: front-matter ausente`)
  const meta: Record<string, string> = {}
  for (const line of fm[1]!.split(/\r?\n/)) {
    const m = /^\s*([\w-]+)\s*:\s*(.*?)\s*$/.exec(line)
    if (m) meta[m[1]!] = m[2]!.replace(/^['"]|['"]$/g, '')
  }
  const body = fm[2]!
  const system = /<system>([\s\S]*?)<\/system>/.exec(body)?.[1]?.trim()
  const user = /<user>([\s\S]*?)<\/user>/.exec(body)?.[1]?.trim()
  if (!meta.id || !meta.version) throw new Error(`Prompt ${file}: front-matter sem id ou version`)
  if (!system || !user) throw new Error(`Prompt ${file}: blocos <system> e <user> são obrigatórios`)
  return { id: meta.id, version: meta.version, system, user }
}

const cache = new Map<string, PromptTemplate>()

/** Carrega `src/prompts/<id>.md` (com cache em memória). */
export function loadPrompt(id: string): PromptTemplate {
  let tpl = cache.get(id)
  if (!tpl) {
    const file = join(PROMPTS_DIR, `${id}.md`)
    tpl = parsePrompt(readFileSync(file, 'utf8'), file)
    if (tpl.id !== id) throw new Error(`Prompt ${file}: id "${tpl.id}" difere do nome do arquivo`)
    cache.set(id, tpl)
  }
  return tpl
}

/** Substitui `{{nome}}` pelos valores; variável ausente ou sobrando é erro. */
export function renderPrompt(
  tpl: PromptTemplate,
  vars: Record<string, string | number>,
): RenderedPrompt {
  const used = new Set<string>()
  const fill = (text: string): string =>
    text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name: string) => {
      const value = vars[name]
      if (value === undefined) throw new Error(`Prompt ${tpl.id}: variável {{${name}}} sem valor`)
      used.add(name)
      return String(value)
    })
  const rendered = {
    promptId: tpl.id,
    promptVersion: tpl.version,
    system: fill(tpl.system),
    prompt: fill(tpl.user),
  }
  const unused = Object.keys(vars).filter((k) => !used.has(k))
  if (unused.length > 0)
    throw new Error(`Prompt ${tpl.id}: variáveis não usadas: ${unused.join(', ')}`)
  return rendered
}
