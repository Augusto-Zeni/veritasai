import type { VerificationResult } from '@veritasai/core/domain'
import { ChevronDown, Cpu } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { formatDateTime, formatDuration, formatNumber, thresholdsOf } from '@/lib/format.ts'

const VARIANT_TEXT: Record<string, string> = {
  full: 'pipeline completo',
  'full-no-factcheck-domains': 'pipeline completo, sem agências de checagem na busca',
  'no-decomposition': 'sem decomposição em afirmações',
  'no-retrieval': 'sem busca de evidências',
}

/** Dados de reprodutibilidade: modelo, versões dos prompts, limiares, custo. */
export function TechnicalDetails({ result }: { result: VerificationResult }) {
  const m = result.meta
  const t = thresholdsOf(m)
  const rows: [string, string][] = [
    ['Modelo', m.model],
    ['Variante', VARIANT_TEXT[m.variant] ?? m.variant],
    [
      'Prompts',
      Object.entries(m.promptVersions)
        .map(([k, v]) => `${k} v${v}`)
        .join(', '),
    ],
    ...(t
      ? ([
          [
            'Limiares',
            `cobertura ≥ ${t.coverageMin}, verdadeiro ≥ ${t.trueMin}, falso ≤ ${t.falseMax}`,
          ],
        ] as [string, string][])
      : []),
    ['Tempo total', formatDuration(m.latencyMs.total ?? 0)],
    [
      'Tokens',
      `${formatNumber(m.tokens.input)} de entrada + ${formatNumber(m.tokens.output)} de saída`,
    ],
    [
      'Chamadas',
      Object.entries(m.apiCalls)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ') || 'nenhuma (cache)',
    ],
    ['Extração do texto', `${m.scrapeMethod}${m.truncated ? ' (texto truncado)' : ''}`],
    [
      'Agências de checagem',
      m.excludedFactcheckDomains ? 'excluídas da busca' : 'incluídas na busca',
    ],
    ['Verificado em', formatDateTime(m.timestamp)],
  ]

  return (
    <Collapsible className='rounded-2xl border bg-card/60'>
      <CollapsibleTrigger className='group flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'>
        <span className='flex items-center gap-2'>
          <Cpu className='size-4 text-muted-foreground' aria-hidden='true' />
          Detalhes técnicos
        </span>
        <ChevronDown
          className='size-4 transition-transform duration-300 group-data-[state=open]:rotate-180'
          aria-hidden='true'
        />
      </CollapsibleTrigger>
      <CollapsibleContent className='overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down'>
        <dl className='grid gap-x-6 gap-y-2.5 px-4 pt-1 pb-4 text-sm sm:grid-cols-[auto_1fr]'>
          {rows.map(([k, v]) => (
            <div key={k} className='contents'>
              <dt className='text-muted-foreground'>{k}</dt>
              <dd className='-mt-2 mb-1 break-words sm:mt-0 sm:mb-0'>{v}</dd>
            </div>
          ))}
        </dl>
        {m.warnings.length > 0 && (
          <div className='mx-4 mb-4 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning-strong'>
            <p className='font-medium'>Avisos</p>
            <ul className='mt-1 list-disc pl-4'>
              {m.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
