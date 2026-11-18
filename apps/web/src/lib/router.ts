/**
 * Roteador mínimo (History API) para as 3 rotas da aplicação, com transição suave
 * entre telas. Evita uma dependência só para isso.
 */
import { useSyncExternalStore, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { withViewTransition } from './transition.ts'

export type Route =
  | { name: 'home' }
  | { name: 'verification'; id: string }
  | { name: 'about' }
  | { name: 'not-found' }

export function matchRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return { name: 'home' }
  if (path === '/sobre') return { name: 'about' }
  const m = /^\/verificacao\/([^/]+)$/.exec(path)
  if (m?.[1]) return { name: 'verification', id: decodeURIComponent(m[1]) }
  return { name: 'not-found' }
}

export const paths = {
  home: () => '/',
  about: () => '/sobre',
  verification: (id: string) => `/verificacao/${encodeURIComponent(id)}`,
}

const listeners = new Set<() => void>()

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  window.addEventListener('popstate', fn)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('popstate', fn)
  }
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname)
}

export function navigate(to: string, { replace = false } = {}): void {
  if (to === window.location.pathname) return
  withViewTransition(() => {
    flushSync(() => {
      if (replace) window.history.replaceState(null, '', to)
      else window.history.pushState(null, '', to)
      for (const fn of listeners) fn()
    })
    window.scrollTo({ top: 0 })
  })
}

/** onClick para <a href>: navega sem recarregar (mantém Ctrl/⌘+clique abrindo nova aba). */
export function linkHandler(to: string) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return
    e.preventDefault()
    navigate(to)
  }
}
