import { Compass, Home } from 'lucide-react'
import { useEffect } from 'react'
import { Layout } from '@/components/layout.tsx'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/lib/theme.tsx'
import { linkHandler, matchRoute, paths, usePathname, type Route } from '@/lib/router.ts'
import { AboutPage } from '@/pages/about-page.tsx'
import { HomePage } from '@/pages/home-page.tsx'
import { VerificationPage } from '@/pages/verification-page.tsx'

function NotFoundPage() {
  return (
    <div className='animate-in fade-in flex flex-col items-center gap-4 py-16 text-center'>
      <Compass className='size-10 text-muted-foreground' aria-hidden='true' />
      <h1 className='text-2xl font-semibold'>Página não encontrada</h1>
      <Button asChild>
        <a href={paths.home()} onClick={linkHandler(paths.home())}>
          <Home />
          Voltar ao início
        </a>
      </Button>
    </div>
  )
}

const TITLES: Partial<Record<Route['name'], string>> = {
  home: 'VeritasAI — verificação de notícias',
  about: 'Como funciona · VeritasAI',
  'not-found': 'Página não encontrada · VeritasAI',
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <HomePage />
    case 'about':
      return <AboutPage />
    case 'verification':
      // key: estado novo a cada verificação
      return <VerificationPage key={route.id} id={route.id} />
    case 'not-found':
      return <NotFoundPage />
  }
}

export function App() {
  const route = matchRoute(usePathname())

  useEffect(() => {
    const title = TITLES[route.name]
    if (title) document.title = title
  }, [route.name])

  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={300}>
        <Layout>
          <Page route={route} />
        </Layout>
      </TooltipProvider>
    </ThemeProvider>
  )
}
