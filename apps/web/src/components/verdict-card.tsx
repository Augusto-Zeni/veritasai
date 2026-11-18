import type { VerificationResult } from '@veritasai/core/domain'
import { Card, CardContent } from '@/components/ui/card'
import { countLabels, coverageText, scoreText, thresholdsOf, VERDICT_TEXT } from '@/lib/format.ts'
import { VERDICT_TONE } from '@/lib/tones.ts'
import { cn } from '@/lib/utils'

/** Barra de -1 (contradizem) a +1 (confirmam) com o marcador do score. */
function ScoreMeter({
  score,
  trueMin,
  falseMax,
}: {
  score: number | null
  trueMin?: number
  falseMax?: number
}) {
  const pos = (v: number) => `${((v + 1) / 2) * 100}%`
  return (
    <div className='mt-3' aria-hidden='true'>
      <div className='relative h-2 rounded-full bg-gradient-to-r from-danger/70 via-warning/60 to-success/70'>
        {falseMax !== undefined && (
          <span
            className='absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-foreground/25'
            style={{ left: pos(falseMax) }}
          />
        )}
        {trueMin !== undefined && (
          <span
            className='absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-foreground/25'
            style={{ left: pos(trueMin) }}
          />
        )}
        {score !== null && (
          <span
            className='animate-in zoom-in-50 absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-foreground shadow-md transition-[left] duration-700'
            style={{ left: pos(score) }}
          />
        )}
      </div>
      <div className='mt-1.5 flex justify-between text-[0.7rem] text-muted-foreground'>
        <span>contradizem</span>
        <span>confirmam</span>
      </div>
    </div>
  )
}

export function VerdictCard({ result }: { result: VerificationResult }) {
  const tone = VERDICT_TONE[result.verdict]
  const Icon = tone.icon
  const text = VERDICT_TEXT[result.verdict]
  const counts = countLabels(result.claims.map((c) => c.label))
  const thresholds = thresholdsOf(result.meta)
  const coveragePct = Math.round(result.coverage * 100)

  return (
    <Card
      className={cn(
        'animate-in fade-in zoom-in-[0.98] gap-0 overflow-hidden py-0 duration-500',
        tone.border,
      )}
    >
      <div className={cn('relative px-5 pt-6 pb-5 sm:px-7 sm:pt-7', tone.soft)}>
        <div className='flex items-center gap-4'>
          <span
            className={cn(
              'animate-in zoom-in-75 flex size-14 shrink-0 items-center justify-center rounded-2xl bg-card shadow-sm duration-700',
              tone.text,
            )}
          >
            <Icon className='size-8' strokeWidth={2.2} aria-hidden='true' />
          </span>
          <div>
            <p className={cn('text-xs font-semibold tracking-widest uppercase', tone.text)}>
              Veredito
            </p>
            <p
              className={cn(
                'text-3xl leading-tight font-semibold tracking-tight sm:text-4xl',
                tone.text,
              )}
            >
              {text.label}
            </p>
          </div>
        </div>
        <p className='mt-4 leading-relaxed text-pretty text-foreground/85'>{text.summary}</p>
      </div>

      <CardContent className='grid gap-5 p-5 sm:grid-cols-2 sm:p-7'>
        <div>
          <p className='text-sm font-medium'>Cobertura</p>
          <p className='mt-0.5 text-sm text-muted-foreground'>{coverageText(counts)}</p>
          <div className='mt-3 flex items-center gap-3'>
            <div
              className='relative h-2 flex-1 overflow-hidden rounded-full bg-muted'
              role='meter'
              aria-label='Cobertura'
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={coveragePct}
            >
              <span
                className='absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700'
                style={{ width: `${coveragePct}%` }}
              />
              {thresholds && (
                <span
                  aria-hidden='true'
                  className='absolute inset-y-0 w-px bg-foreground/30'
                  style={{ left: `${thresholds.coverageMin * 100}%` }}
                />
              )}
            </div>
            <span className='text-sm font-medium tabular-nums'>{coveragePct}%</span>
          </div>
        </div>
        <div>
          <p className='text-sm font-medium'>
            Equilíbrio das evidências
            {result.score !== null && (
              <span className='ml-2 font-normal text-muted-foreground tabular-nums'>
                ({result.score > 0 ? '+' : ''}
                {result.score.toFixed(2).replace('.', ',')})
              </span>
            )}
          </p>
          <p className='mt-0.5 text-sm text-muted-foreground'>{scoreText(result.score, counts)}</p>
          <ScoreMeter
            score={result.score}
            {...(thresholds ? { trueMin: thresholds.trueMin, falseMax: thresholds.falseMax } : {})}
          />
        </div>
        <p className='border-t pt-5 leading-relaxed text-pretty sm:col-span-2'>
          {result.explanation}
        </p>
      </CardContent>
    </Card>
  )
}
