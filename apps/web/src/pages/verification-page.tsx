import { CircleX, Home, Loader2, RotateCw, SearchX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ProgressView } from '@/components/progress-view.tsx'
import { ResultView } from '@/components/result-view.tsx'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useVerification } from '@/hooks/use-verification.ts'
import { ApiError, createVerification, getVerification } from '@/lib/api.ts'
import { linkHandler, navigate, paths } from '@/lib/router.ts'

function ProblemCard({
  icon: Icon,
  title,
  message,
  retryUrl,
}: {
  icon: typeof CircleX
  title: string
  message: string
  retryUrl?: string | null
}) {
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headingRef.current?.focus(), [])

  async function retry() {
    if (!retryUrl) return
    setRetrying(true)
    try {
      const { id } = await createVerification(retryUrl)
      navigate(paths.verification(id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível tentar de novo.')
      setRetrying(false)
    }
  }

  return (
    <Card className='animate-in fade-in zoom-in-[0.98] mx-auto max-w-lg text-center duration-500'>
      <CardContent className='flex flex-col items-center gap-3 p-8'>
        <span className='flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger-strong'>
          <Icon className='size-7' aria-hidden='true' />
        </span>
        <h1 ref={headingRef} tabIndex={-1} className='text-xl font-semibold outline-none'>
          {title}
        </h1>
        <p className='leading-relaxed text-pretty text-muted-foreground'>{message}</p>
        {error && (
          <p role='alert' className='text-sm text-destructive'>
            {error}
          </p>
        )}
        <div className='mt-2 flex flex-wrap justify-center gap-2'>
          {retryUrl && (
            <Button onClick={retry} disabled={retrying}>
              {retrying ? <Loader2 className='animate-spin' /> : <RotateCw />}
              Tentar novamente
            </Button>
          )}
          <Button variant='outline' asChild>
            <a href={paths.home()} onClick={linkHandler(paths.home())}>
              <Home />
              Nova verificação
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function VerificationPage({ id }: { id: string }) {
  const state = useVerification(id)
  const [retryUrl, setRetryUrl] = useState<string | null>(null)

  // Para oferecer "tentar novamente" é preciso saber a URL da notícia.
  useEffect(() => {
    if (state.phase !== 'error') return
    let alive = true
    getVerification(id)
      .then((job) => alive && setRetryUrl(job.url))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [state.phase, id])

  useEffect(() => {
    const title = state.result?.article.title ?? state.article?.title
    document.title = state.result
      ? `${title ?? 'Resultado'} · VeritasAI`
      : state.phase === 'error'
        ? 'Erro · VeritasAI'
        : 'Verificando… · VeritasAI'
    return () => {
      document.title = 'VeritasAI'
    }
  }, [state.result, state.article, state.phase])

  if (state.phase === 'done' && state.result) return <ResultView result={state.result} />
  if (state.phase === 'error') {
    return (
      <ProblemCard
        icon={CircleX}
        title='Não foi possível verificar'
        message={state.error?.message ?? 'Ocorreu um erro inesperado.'}
        retryUrl={retryUrl}
      />
    )
  }
  if (state.phase === 'not-found') {
    return (
      <ProblemCard
        icon={SearchX}
        title='Verificação não encontrada'
        message='Este link expirou ou não existe. Os resultados ficam disponíveis por alguns minutos; verifique a notícia de novo (se ela já foi verificada, o resultado sai na hora).'
      />
    )
  }
  return <ProgressView state={state} />
}
