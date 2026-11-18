import type { ReactNode } from 'react'
import { Disclaimer } from '@/components/disclaimer.tsx'
import { Logo } from '@/components/logo.tsx'
import { ThemeToggle } from '@/components/theme-toggle.tsx'
import { linkHandler, paths, usePathname } from '@/lib/router.ts'
import { cn } from '@/lib/utils'

function NavLink({
  to,
  children,
  className,
}: {
  to: string
  children: ReactNode
  className?: string
}) {
  const active = usePathname() === to
  return (
    <a
      href={to}
      onClick={linkHandler(to)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        active && 'bg-accent text-accent-foreground',
        className,
      )}
    >
      {children}
    </a>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className='relative flex min-h-dvh flex-col'>
      <div className='app-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem]' />
      <a
        href='#conteudo'
        className='sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3'
      >
        Pular para o conteúdo
      </a>
      <header className='sticky top-0 z-40 border-b border-transparent bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55'>
        <div className='mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4'>
          <a
            href={paths.home()}
            onClick={linkHandler(paths.home())}
            className='rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'
            aria-label='VeritasAI — página inicial'
          >
            <Logo />
          </a>
          <nav aria-label='Principal' className='flex items-center gap-1'>
            <NavLink to={paths.home()} className='hidden sm:inline-flex'>
              Verificar
            </NavLink>
            <NavLink to={paths.about()}>Como funciona</NavLink>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id='conteudo' className='mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-12 sm:pt-10'>
        {children}
      </main>
      <footer className='mx-auto w-full max-w-3xl px-4 pb-8'>
        <Disclaimer />
        <p className='mt-4 text-center text-xs text-muted-foreground'>
          VeritasAI · TCC de Engenharia de Software (Univates) · sem cadastro, sem cookies, sem
          rastreamento
        </p>
      </footer>
    </div>
  )
}
