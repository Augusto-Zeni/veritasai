import type { ClaimLabel, VerificationResult } from '@veritasai/core/domain'
import { ArrowLeft, ExternalLink, History, Loader2, RotateCw, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { ClaimCard } from '@/components/claim-card.tsx'
import { TechnicalDetails } from '@/components/technical-details.tsx'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { VerdictCard } from '@/components/verdict-card.tsx'
import { ApiError, createVerification } from '@/lib/api.ts'
import { countLabels, formatDateTime, LABEL_TEXT } from '@/lib/format.ts'
import { linkHandler, navigate, paths } from '@/lib/router.ts'

type Filter = 'all' | ClaimLabel
const FILTERS: ClaimLabel[] = ['SUPORTADA', 'CONTRADITA', 'INSUFICIENTE']

export function ResultView({ result }: { result: VerificationResult }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [rechecking, setRechecking] = useState(false)
  const [recheckError, setRecheckError] = useState<string | null>(null)
  const counts = countLabels(result.claims.map((c) => c.label))
  const visible = filter === 'all' ? result.claims : result.claims.filter((c) => c.label === filter)

  async function recheck() {
    setRechecking(true)
    setRecheckError(null)
    try {
      const { id } = await createVerification(result.article.url, true)
      navigate(paths.verification(id))
    } catch (err) {
      setRecheckError(err instanceof ApiError ? err.message : 'Não foi possível verificar de novo.')
      setRechecking(false)
    }
  }

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex items-center justify-between gap-3'>
        <Button variant='ghost' size='sm' asChild className='-ml-2 text-muted-foreground'>
          <a href={paths.home()} onClick={linkHandler(paths.home())}>
            <ArrowLeft />
            Nova verificação
          </a>
        </Button>
        {result.meta.cacheHit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                onClick={recheck}
                disabled={rechecking}
                className='rounded-full'
              >
                {rechecking ? <Loader2 className='animate-spin' /> : <RotateCw />}
                Verificar de novo
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refaz a busca de evidências agora</TooltipContent>
          </Tooltip>
        )}
      </div>

      <header className='animate-in fade-in flex flex-col gap-2 duration-500'>
        <p className='text-sm font-medium text-muted-foreground'>{result.article.domain}</p>
        <h1 className='text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl'>
          {result.article.title ?? 'Notícia sem título'}
        </h1>
        <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-sm'>
          <a
            href={result.article.url}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline'
          >
            Abrir notícia original
            <ExternalLink className='size-3.5' aria-hidden='true' />
            <span className='sr-only'>(abre em nova aba)</span>
          </a>
          {result.meta.cacheHit && (
            <span className='inline-flex items-center gap-1 text-muted-foreground'>
              <History className='size-3.5' aria-hidden='true' />
              Resultado salvo de {formatDateTime(result.meta.timestamp)}
            </span>
          )}
        </div>
        {recheckError && (
          <p role='alert' className='text-sm text-destructive'>
            {recheckError}
          </p>
        )}
        {result.meta.truncated && (
          <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
            <TriangleAlert className='size-3.5' aria-hidden='true' />
            Notícia longa: só o início do texto foi analisado.
          </p>
        )}
      </header>

      <VerdictCard result={result} />

      <section aria-labelledby='afirmacoes' className='flex flex-col gap-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
          <h2 id='afirmacoes' className='text-lg font-semibold tracking-tight'>
            Afirmações verificadas
          </h2>
          {result.claims.length > 1 && (
            <Tabs
              value={filter}
              onValueChange={(v) => setFilter(v as Filter)}
              className='-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0'
            >
              <TabsList className='w-max rounded-xl'>
                <TabsTrigger value='all' className='flex-none rounded-lg px-3'>
                  Todas{' '}
                  <span className='text-muted-foreground tabular-nums'>{result.claims.length}</span>
                </TabsTrigger>
                {FILTERS.filter((l) => counts[l] > 0).map((l) => (
                  <TabsTrigger key={l} value={l} className='flex-none rounded-lg px-3'>
                    {LABEL_TEXT[l].plural}{' '}
                    <span className='text-muted-foreground tabular-nums'>{counts[l]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>
        <div key={filter} className='flex flex-col gap-3'>
          {visible.map((item, i) => (
            <ClaimCard key={item.claim.id} item={item} index={i} />
          ))}
        </div>
      </section>

      <TechnicalDetails result={result} />
    </div>
  )
}
