/**
 * CLI para testar o pipeline sem frontend:
 *
 *   pnpm verify <url> [--json] [--force] [--exclude-factcheck]
 *
 * O progresso vai para stderr; o resultado vai para stdout.
 */
import { parseArgs } from 'node:util'
import { loadConfig } from './config.ts'
import type { ClaimLabel, NewsVerdict, VerificationResult } from './domain/schemas.ts'
import { VeritasError } from './errors.ts'
import { createPipeline, type PipelineHandle } from './factory.ts'
import type { PipelineEvent, PipelineStage } from './pipeline.ts'
import { coverageSentence } from './services/explanation.ts'
import { computeScore } from './services/scoring.ts'

const USAGE = `Uso: pnpm verify <url> [opções]

Opções:
  --json                 imprime o VerificationResult completo em JSON
  --force                ignora o cache de verificações (LLM/busca continuam em cache)
  --exclude-factcheck    exclui domínios de agências de checagem da busca
  -h, --help             mostra esta ajuda`

const STAGE_LABELS: Record<PipelineStage, string> = {
  scrape: 'Extraindo texto da notícia',
  claims: 'Extraindo afirmações',
  queries: 'Gerando consultas de busca',
  evidence: 'Buscando evidências e classificando',
  scoring: 'Agregando resultado',
}

const LABEL_ICONS: Record<ClaimLabel, string> = {
  SUPORTADA: '✔ SUPORTADA ',
  CONTRADITA: '✘ CONTRADITA',
  INSUFICIENTE: '? INSUFICIENTE',
}

const VERDICT_ICONS: Record<NewsVerdict, string> = {
  VERDADEIRO: '✔ VERDADEIRO',
  FALSO: '✘ FALSO',
  IMPRECISO: '≈ IMPRECISO',
}

const DISCLAIMER =
  'Aviso: o resultado se baseia em evidências públicas disponíveis no momento da consulta. ' +
  'O modelo pode errar, ter vieses ou alucinar. Não substitui checagem profissional — consulte as fontes citadas.'

function logProgress(event: PipelineEvent): void {
  const out = process.stderr
  switch (event.type) {
    case 'cache-hit':
      out.write('↺ Resultado encontrado no cache (use --force para refazer)\n')
      break
    case 'stage':
      if (event.status === 'start') out.write(`→ ${STAGE_LABELS[event.stage]}...\n`)
      break
    case 'article':
      out.write(
        `  ${event.title ?? '(sem título)'} — ${event.domain}${event.truncated ? ' [truncado]' : ''}\n`,
      )
      break
    case 'claims':
      out.write(`  ${event.claims.length} afirmações extraídas\n`)
      break
    case 'claim-done':
      out.write(`  (${event.done}/${event.total}) ${event.claimId}: ${event.label}\n`)
      break
  }
}

export function formatResult(result: VerificationResult): string {
  const counts = computeScore(result.claims.map((c) => c.label)).counts
  const lines: string[] = [
    '',
    `Notícia: ${result.article.title ?? result.article.url}`,
    `URL: ${result.article.url}`,
    '',
    `Veredito: ${VERDICT_ICONS[result.verdict]}`,
    `Score: ${result.score === null ? '—' : result.score.toFixed(2)} | Cobertura: ${Math.round(result.coverage * 100)}% (${coverageSentence({ counts })})`,
    '',
    result.explanation,
    '',
    'Afirmações:',
  ]
  for (const c of result.claims) {
    lines.push('', `${LABEL_ICONS[c.label]}  [${c.claim.id}] ${c.claim.text}`)
    lines.push(`    Justificativa: ${c.rationale}`)
    lines.push(`    Consulta: ${c.query}`)
    const used = new Set(c.evidenceIdsUsed)
    for (const e of c.evidences) {
      const mark = used.has(e.id) ? '*' : ' '
      lines.push(`   ${mark}[${e.id}] ${e.domain} — ${e.title}`)
      lines.push(`        ${e.url}`)
    }
  }
  const m = result.meta
  lines.push(
    '',
    '(* = evidência usada na decisão)',
    '',
    `Modelo: ${m.model} | Prompts: ${Object.entries(m.promptVersions)
      .map(([k, v]) => `${k}@${v}`)
      .join(', ')}`,
    `Tokens: ${m.tokens.input} entrada + ${m.tokens.output} saída | Chamadas: ${JSON.stringify(m.apiCalls)} | Cache: ${JSON.stringify(m.cacheHits)}`,
    `Tempo total: ${((m.latencyMs.total ?? 0) / 1000).toFixed(1)} s | Extração: ${m.scrapeMethod}${m.truncated ? ' (truncado)' : ''}`,
  )
  if (m.warnings.length > 0) lines.push('', 'Avisos:', ...m.warnings.map((w) => `  - ${w}`))
  lines.push('', DISCLAIMER, '')
  return lines.join('\n')
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      'exclude-factcheck': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  const url = positionals[0]
  if (values.help || !url) {
    process.stderr.write(`${USAGE}\n`)
    return values.help ? 0 : 1
  }

  let handle: PipelineHandle | undefined
  try {
    const config = loadConfig(
      process.env,
      values['exclude-factcheck'] ? { excludeFactcheckDomains: true } : {},
    )
    handle = createPipeline(config, {
      onReaderFallback: ({ url: u, reason }) =>
        process.stderr.write(`  ! Jina falhou em ${u} (${reason}); usando Readability\n`),
    })
    const result = await handle.pipeline.run(url, { onEvent: logProgress, force: values.force })
    process.stdout.write(
      values.json ? `${JSON.stringify(result, null, 2)}\n` : formatResult(result),
    )
    return 0
  } catch (err) {
    const label = err instanceof VeritasError ? `${err.name} (${err.code})` : 'Erro'
    process.stderr.write(`\n✘ ${label}: ${err instanceof Error ? err.message : String(err)}\n`)
    return 1
  } finally {
    await handle?.close()
  }
}

if (import.meta.main) {
  process.exitCode = await main()
}
