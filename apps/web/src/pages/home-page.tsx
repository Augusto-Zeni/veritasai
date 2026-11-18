import {
  ArrowRight,
  ClipboardPaste,
  FileText,
  Link2,
  ListChecks,
  Loader2,
  Scale,
  Search,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError, createVerification, getHealth, type Health } from '@/lib/api.ts'
import { validateUrlInput } from '@/lib/format.ts'
import { navigate, paths } from '@/lib/router.ts'
import { cn } from '@/lib/utils'

const STEPS = [
  { icon: FileText, title: 'Lê a notícia', text: 'Extrai o texto do link informado.' },
  {
    icon: ListChecks,
    title: 'Separa as afirmações',
    text: 'Divide o texto em fatos que podem ser checados.',
  },
  {
    icon: Search,
    title: 'Busca evidências',
    text: 'Procura fontes públicas para cada afirmação.',
  },
  {
    icon: Scale,
    title: 'Mostra o veredito',
    text: 'Combina os resultados e cita as fontes usadas.',
  },
]

type HealthState = { kind: 'loading' } | { kind: 'ok'; health: Health } | { kind: 'offline' }

export function HomePage() {
  const inputId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' })

  useEffect(() => {
    let alive = true
    getHealth()
      .then((h) => alive && setHealth({ kind: 'ok', health: h }))
      .catch(() => alive && setHealth({ kind: 'offline' }))
    return () => {
      alive = false
    }
  }, [])

  const unavailable = health.kind === 'offline' || (health.kind === 'ok' && !health.health.ready)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const checked = validateUrlInput(value)
    if (!checked.ok) {
      setError(checked.message)
      inputRef.current?.focus()
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const { id } = await createVerification(checked.url)
      navigate(paths.verification(id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível iniciar a verificação.')
      setSubmitting(false)
      inputRef.current?.focus()
    }
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setValue(text.trim())
        setError(null)
      }
    } catch {
      // permissão negada: o usuário cola manualmente
    }
    inputRef.current?.focus()
  }

  const canPaste = typeof navigator !== 'undefined' && 'clipboard' in navigator

  return (
    <div className='flex flex-col gap-14'>
      <section className='animate-in fade-in slide-in-from-bottom-2 pt-4 text-center duration-500 sm:pt-10'>
        <p className='mx-auto mb-5 inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur'>
          <span className='size-1.5 rounded-full bg-success' aria-hidden='true' />
          Verificação de notícias em português
        </p>
        <h1 className='mx-auto max-w-xl text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl'>
          Essa notícia se sustenta?
        </h1>
        <p className='mx-auto mt-4 max-w-lg text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg'>
          Cole o link. O VeritasAI separa o texto em afirmações, busca fontes públicas para cada uma
          e mostra o que encontrou.
        </p>

        <form
          onSubmit={onSubmit}
          noValidate
          className='mx-auto mt-9 max-w-xl text-left'
          aria-describedby={error ? errorId : undefined}
        >
          <label htmlFor={inputId} className='sr-only'>
            Link da notícia
          </label>
          <div
            className={cn(
              'group flex flex-col gap-2 rounded-2xl border bg-card p-2 shadow-lg shadow-primary/5 transition-[box-shadow,border-color] duration-300 focus-within:border-ring/60 focus-within:shadow-primary/10 focus-within:ring-4 focus-within:ring-ring/15 sm:flex-row sm:items-center',
              error && 'border-destructive/60 focus-within:ring-destructive/15',
            )}
          >
            <div className='flex flex-1 items-center gap-2 pl-2'>
              <Link2 className='size-5 shrink-0 text-muted-foreground' aria-hidden='true' />
              <Input
                ref={inputRef}
                id={inputId}
                type='url'
                inputMode='url'
                autoComplete='off'
                spellCheck={false}
                placeholder='https://www.exemplo.com.br/noticia'
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  if (error) setError(null)
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                disabled={submitting}
                className='h-11 border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0 dark:bg-transparent'
              />
              {canPaste && !value && (
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={paste}
                  className='shrink-0 text-muted-foreground'
                >
                  <ClipboardPaste />
                  <span className='hidden sm:inline'>Colar</span>
                  <span className='sr-only sm:hidden'>Colar link</span>
                </Button>
              )}
            </div>
            <Button
              type='submit'
              size='lg'
              disabled={submitting || unavailable}
              className='h-11 rounded-xl px-5 text-[0.95rem] shadow-md shadow-primary/20 transition-transform active:scale-[0.98]'
            >
              {submitting ? (
                <>
                  <Loader2 className='animate-spin' />
                  Iniciando…
                </>
              ) : (
                <>
                  Verificar
                  <ArrowRight className='transition-transform group-focus-within:translate-x-0.5' />
                </>
              )}
            </Button>
          </div>
          <div aria-live='polite' className='min-h-6 px-3 pt-2'>
            {error && (
              <p
                id={errorId}
                className='animate-in fade-in slide-in-from-top-1 text-sm font-medium text-destructive'
              >
                {error}
              </p>
            )}
          </div>
        </form>

        {unavailable && (
          <Alert className='animate-in fade-in mx-auto mt-2 max-w-xl border-warning/40 bg-warning-soft text-left text-warning-strong'>
            <TriangleAlert />
            <AlertTitle>
              {health.kind === 'offline' ? 'Servidor fora do ar' : 'Servidor não configurado'}
            </AlertTitle>
            <AlertDescription className='text-warning-strong/90'>
              {health.kind === 'offline'
                ? 'Não foi possível falar com a API. Confira se ela está rodando (pnpm dev).'
                : `A verificação está desativada: ${health.kind === 'ok' ? (health.health.reason ?? '') : ''}.`}
            </AlertDescription>
          </Alert>
        )}
      </section>

      <section aria-labelledby='como-funciona' className='animate-in fade-in duration-700'>
        <h2
          id='como-funciona'
          className='mb-4 text-center text-sm font-medium tracking-wide text-muted-foreground uppercase'
        >
          Como funciona
        </h2>
        <ol className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li
              key={title}
              className='group relative rounded-2xl border bg-card/70 p-4 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5'
            >
              <div className='mb-3 flex items-center justify-between'>
                <span className='flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground'>
                  <Icon className='size-[1.1rem]' aria-hidden='true' />
                </span>
                <span className='text-xs font-medium text-muted-foreground tabular-nums'>
                  {i + 1}/4
                </span>
              </div>
              <h3 className='font-medium'>{title}</h3>
              <p className='mt-1 text-sm leading-relaxed text-muted-foreground'>{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
