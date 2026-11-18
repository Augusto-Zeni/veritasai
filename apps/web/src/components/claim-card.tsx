import type { ClaimResult } from '@veritasai/core/domain'
import { ChevronDown, ExternalLink, Search, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { LabelBadge } from '@/components/label-badge.tsx'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { formatDateTime } from '@/lib/format.ts'
import { cn } from '@/lib/utils'

export function ClaimCard({ item, index }: { item: ClaimResult; index: number }) {
  const [open, setOpen] = useState(false)
  const used = new Set(item.evidenceIdsUsed)
  // Evidências usadas na decisão primeiro.
  const evidences = [...item.evidences].sort(
    (a, b) => Number(used.has(b.id)) - Number(used.has(a.id)),
  )
  const n = evidences.length

  return (
    <article
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      className='animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-2xl border bg-card p-4 shadow-xs transition-shadow duration-300 hover:shadow-md hover:shadow-primary/5 sm:p-5'
    >
      <div className='flex flex-col gap-3'>
        <LabelBadge label={item.label} />
        <h3 className='leading-relaxed font-medium text-pretty'>{item.claim.text}</h3>
        <p className='text-sm leading-relaxed text-muted-foreground'>
          <span className='font-medium text-foreground/80'>Por quê: </span>
          {item.rationale}
        </p>
        {item.error && (
          <p className='flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-strong'>
            <TriangleAlert className='mt-px size-3.5 shrink-0' aria-hidden='true' />
            Esta afirmação não pôde ser verificada por completo (falha temporária).
          </p>
        )}
      </div>

      {n > 0 ? (
        <Collapsible open={open} onOpenChange={setOpen} className='mt-4'>
          <CollapsibleTrigger className='group flex w-full items-center justify-between rounded-xl bg-muted/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'>
            <span>
              {open ? 'Ocultar' : 'Ver'} {n === 1 ? '1 evidência' : `${n} evidências`}
              {used.size > 0 && (
                <span className='font-normal text-muted-foreground'>
                  {' '}
                  · {used.size} {used.size === 1 ? 'usada' : 'usadas'} na decisão
                </span>
              )}
            </span>
            <ChevronDown
              className='size-4 transition-transform duration-300 group-data-[state=open]:rotate-180'
              aria-hidden='true'
            />
          </CollapsibleTrigger>
          <CollapsibleContent className='overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down'>
            <ul className='flex flex-col gap-2 pt-3'>
              {evidences.map((e) => (
                <li
                  key={e.id}
                  className={cn(
                    'rounded-xl border px-3.5 py-3',
                    used.has(e.id) ? 'border-primary/25 bg-accent/40' : 'bg-background/50',
                  )}
                >
                  <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground'>
                    <span className='font-medium text-foreground/80'>{e.domain}</span>
                    {e.publishedAt && <span>· {formatDateTime(e.publishedAt)}</span>}
                    {used.has(e.id) && (
                      <span className='rounded-full bg-primary/12 px-2 py-px font-medium text-primary'>
                        usada na decisão
                      </span>
                    )}
                  </div>
                  <a
                    href={e.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='mt-1 inline-flex items-start gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'
                  >
                    {e.title || e.url}
                    <ExternalLink className='mt-0.5 size-3.5 shrink-0' aria-hidden='true' />
                    <span className='sr-only'>(abre em nova aba)</span>
                  </a>
                  <blockquote className='mt-2 border-l-2 pl-3 text-sm leading-relaxed text-muted-foreground'>
                    {e.snippet}
                  </blockquote>
                </li>
              ))}
            </ul>
            <p className='flex items-center gap-1.5 px-1 pt-3 text-xs text-muted-foreground'>
              <Search className='size-3' aria-hidden='true' />
              Busca usada: “{item.query}”
            </p>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <p className='mt-4 flex items-center gap-1.5 rounded-xl bg-muted/70 px-3 py-2 text-sm text-muted-foreground'>
          <Search className='size-3.5' aria-hidden='true' />
          Nenhuma fonte relevante encontrada para “{item.query}”.
        </p>
      )}
    </article>
  )
}
