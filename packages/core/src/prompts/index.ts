import { loadPrompt } from './loader.ts'

/** Todos os prompts usados pelo pipeline. */
export const PROMPT_IDS = [
  'claim-extraction',
  'query-generation',
  'verification',
  'article-verification',
  'no-retrieval',
] as const
export type PromptId = (typeof PROMPT_IDS)[number]

/** Versão de cada prompt, para o `meta` dos resultados e o `config.json` das avaliações. */
export function promptVersions(
  ids: readonly PromptId[] = PROMPT_IDS,
): Partial<Record<PromptId, string>> {
  return Object.fromEntries(ids.map((id) => [id, loadPrompt(id).version]))
}

/** Prompts usados por cada variante (só estes entram no `meta` e na chave do cache). */
export const PROMPTS_BY_VARIANT = {
  full: ['claim-extraction', 'query-generation', 'verification'],
  'full-no-factcheck-domains': ['claim-extraction', 'query-generation', 'verification'],
  'no-decomposition': ['query-generation', 'article-verification'],
  'no-retrieval': ['no-retrieval'],
} as const satisfies Record<string, readonly PromptId[]>
