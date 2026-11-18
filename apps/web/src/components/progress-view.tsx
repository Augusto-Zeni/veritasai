import { Check, Clock, Globe, Loader2, RefreshCw, Users } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { LabelBadge } from '@/components/label-badge.tsx'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import type { PipelineStage } from '@/lib/api.ts'
import { formatDuration, STAGE_TEXT } from '@/lib/format.ts'
import { STAGES, type StepStatus, type VerificationState } from '@/lib/verification-state.ts'
import { cn } from '@/lib/utils'

/** Fração aproximada do trabalho concluído (para a barra geral). */
export function overallProgress(state: VerificationState): number {
  const { steps, done, total } = state
  if (state.phase === 'done') return 1
  if (steps.scoring !== 'pending') return 0.96
  if (steps.evidence !== 'pending') return 0.3 + 0.62 * (total > 0 ? done / total : 0)
  if (steps.queries !== 'pending') return 0.26
  if (steps.claims !== 'pending') return 0.14
  if (steps.scrape !== 'pending') return 0.05
  return 0.02
}

function useElapsed(running: boolean): number {
  const [start] = useState(() => Date.now())
  const [now, setNow] = useState(start)
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])
  return now - start
}

function StepIndicator({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <span className='animate-in zoom-in-50 flex size-7 items-center justify-center rounded-full bg-success text-white duration-300 dark:text-background'>
        <Check className='size-4' strokeWidth={3} aria-hidden='true' />
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span className='relative flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary'>
        <span className='absolute inset-0 animate-ping rounded-full bg-primary/20 [animation-duration:2s]' />
        <Loader2 className='size-4 animate-spin' aria-hidden='true' />
      </span>
    )
  }
  return (
    <span className='flex size-7 items-center justify-center rounded-full border-2 border-dashed border-border'>
      <span className='size-1.5 rounded-full bg-muted-foreground/40' />
    </span>
  )
}

function Step({
  stage,
  status,
  isLast,
  extra,
}: {
  stage: PipelineStage
  status: StepStatus
  isLast: boolean
  extra?: ReactNode
}) {
  const text = STAGE_TEXT[stage]
  return (
    <li className='relative flex gap-4 pb-6 last:pb-0'>
      {!isLast && (
        <span
          aria-hidden='true'
          className={cn(
            'absolute top-8 left-3.5 h-[calc(100%-2.25rem)] w-0.5 -translate-x-1/2 rounded-full transition-colors duration-500',
            status === 'done' ? 'bg-success/50' : 'bg-border',
          )}
        />
      )}
      <StepIndicator status={status} />
      <div className='min-w-0 flex-1 pt-0.5'>
        <p
          className={cn(
            'font-medium transition-colors duration-300',
            status === 'pending' && 'text-muted-foreground',
          )}
        >
          {text.label}
          <span className='sr-only'>
            {status === 'done' ? ' (concluído)' : status === 'active' ? ' (em andamento)' : ''}
          </span>
        </p>
        <p className='text-sm text-muted-foreground'>{text.detail}</p>
        {extra}
      </div>
    </li>
  )
}

export function ProgressView({ state }: { state: VerificationState }) {
  const elapsed = useElapsed(true)
  const progress = overallProgress(state)
  const activeStage = STAGES.find((s) => state.steps[s] === 'active')

  return (
    <div className='flex flex-col gap-5'>
      <div aria-live='polite' className='sr-only'>
        {state.phase === 'queued' && state.queuePosition
          ? `Na fila, posição ${state.queuePosition}`
          : activeStage
            ? STAGE_TEXT[activeStage].label
            : ''}
      </div>

      <Card className='animate-in fade-in slide-in-from-bottom-2 gap-0 overflow-hidden py-0 duration-500'>
        <Progress
          value={progress * 100}
          aria-label='Progresso da verificação'
          className='h-1 rounded-none bg-transparent [&>div]:transition-transform [&>div]:duration-700 [&>div]:ease-out'
        />
        <CardContent className='flex flex-col gap-5 p-5 sm:p-6'>
          <div className='flex items-start justify-between gap-4'>
            <div className='min-w-0 flex-1'>
              <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
                Verificando
              </p>
              {state.article ? (
                <div className='animate-in fade-in duration-500'>
                  <h1 className='mt-1 text-lg leading-snug font-semibold text-balance sm:text-xl'>
                    {state.article.title ?? 'Notícia sem título'}
                  </h1>
                  <p className='mt-1 flex items-center gap-1.5 text-sm text-muted-foreground'>
                    <Globe className='size-3.5' aria-hidden='true' />
                    {state.article.domain}
                  </p>
                </div>
              ) : (
                <div className='mt-2 flex flex-col gap-2'>
                  <h1 className='sr-only'>Verificando a notícia</h1>
                  <Skeleton className='h-5 w-4/5' />
                  <Skeleton className='h-4 w-1/3' />
                </div>
              )}
            </div>
            <span className='flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums'>
              <Clock className='size-3.5' aria-hidden='true' />
              {formatDuration(elapsed)}
            </span>
          </div>

          {state.phase === 'queued' && state.queuePosition !== null && (
            <p className='animate-in fade-in flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground'>
              <Users className='size-4' aria-hidden='true' />
              Outra verificação está em andamento. Você é o {state.queuePosition}º da fila.
            </p>
          )}
          {state.reconnecting && (
            <p className='animate-in fade-in flex items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-strong'>
              <RefreshCw className='size-4 animate-spin' aria-hidden='true' />
              Conexão instável, reconectando…
            </p>
          )}

          <ol aria-label='Etapas da verificação'>
            {STAGES.map((stage, i) => (
              <Step
                key={stage}
                stage={stage}
                status={state.steps[stage]}
                isLast={i === STAGES.length - 1}
                extra={
                  stage === 'evidence' && state.total > 0 && state.steps.evidence !== 'pending' ? (
                    <div className='mt-2 flex items-center gap-3'>
                      <Progress
                        value={(state.done / state.total) * 100}
                        aria-label='Afirmações classificadas'
                        className='h-1.5 [&>div]:bg-success [&>div]:transition-transform [&>div]:duration-500'
                      />
                      <span className='shrink-0 text-xs font-medium text-muted-foreground tabular-nums'>
                        {state.done}/{state.total}
                      </span>
                    </div>
                  ) : undefined
                }
              />
            ))}
          </ol>
        </CardContent>
      </Card>

      {state.claims.length > 0 && (
        <section aria-labelledby='afirmacoes-progresso' className='flex flex-col gap-3'>
          <h2 id='afirmacoes-progresso' className='px-1 text-sm font-medium text-muted-foreground'>
            {state.claims.length === 1
              ? '1 afirmação encontrada'
              : `${state.claims.length} afirmações encontradas`}
          </h2>
          <ul className='flex flex-col gap-2'>
            {state.claims.map((claim, i) => {
              const label = state.labels[claim.id]
              return (
                <li
                  key={claim.id}
                  style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}
                  className='animate-in fade-in slide-in-from-bottom-1 fill-mode-both flex flex-col gap-2 rounded-xl border bg-card/70 px-4 py-3 duration-500 sm:flex-row sm:items-center sm:justify-between sm:gap-4'
                >
                  <p className='text-sm leading-relaxed'>{claim.text}</p>
                  {label ? (
                    <LabelBadge
                      label={label}
                      className='animate-in zoom-in-95 fade-in duration-300'
                    />
                  ) : (
                    <span className='inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground'>
                      <Loader2 className='size-3 animate-spin' aria-hidden='true' />
                      verificando
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <p className='px-1 text-center text-xs text-muted-foreground'>
        Pode levar alguns minutos: as APIs gratuitas limitam quantas consultas fazemos por minuto.
        Você pode deixar esta página aberta.
      </p>
    </div>
  )
}
