import { VeritasError } from '@veritasai/core'

export interface PublicError {
  code: string
  message: string
}

/**
 * Mensagens mostradas ao usuário. As mensagens internas dos erros podem conter
 * detalhes das APIs externas; elas vão só para o log.
 */
const MESSAGES: Record<string, string> = {
  SCRAPE:
    'Não foi possível extrair o texto da notícia. Verifique se o link abre normalmente e se é de uma notícia (não de vídeo, PDF ou página com paywall).',
  SEARCH: 'A busca de evidências falhou. Tente novamente em alguns minutos.',
  LLM: 'O modelo de linguagem não respondeu. Tente novamente em alguns minutos.',
  LLM_QUOTA:
    'A cota gratuita do modelo de linguagem se esgotou por enquanto. Tente novamente mais tarde.',
  LLM_OUTPUT: 'O modelo de linguagem devolveu uma resposta inválida. Tente novamente.',
  CONFIG: 'O servidor não está configurado para verificar notícias (faltam chaves de API).',
}

const INTERNAL = 'Erro interno ao verificar a notícia.'

export function toPublicError(err: unknown): PublicError {
  if (err instanceof VeritasError) {
    return { code: err.code, message: MESSAGES[err.code] ?? INTERNAL }
  }
  return { code: 'INTERNAL', message: INTERNAL }
}
