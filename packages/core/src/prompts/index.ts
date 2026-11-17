import { loadPrompt } from './loader.ts'

/** Todos os prompts usados pelo pipeline. */
export const PROMPT_IDS = ['claim-extraction', 'query-generation', 'verification'] as const
export type PromptId = (typeof PROMPT_IDS)[number]

/** Versão de cada prompt, para o `meta` dos resultados e o `config.json` das avaliações. */
export function promptVersions(): Record<PromptId, string> {
  return Object.fromEntries(PROMPT_IDS.map((id) => [id, loadPrompt(id).version])) as Record<
    PromptId,
    string
  >
}
