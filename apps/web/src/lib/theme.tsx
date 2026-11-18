/**
 * Tema claro/escuro/sistema. A preferência fica no localStorage do navegador (não é
 * dado pessoal nem rastreamento) e é aplicada antes do React carregar (index.html),
 * para não piscar.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { withViewTransition } from './transition.ts'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'veritasai-tema'

interface ThemeContextValue {
  preference: ThemePreference
  resolved: ResolvedTheme
  /** `origin`: ponto da tela de onde a transição circular parte (ex.: o botão). */
  setPreference(pref: ThemePreference, origin?: { x: number; y: number }): void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // localStorage indisponível (modo privado, bloqueio): usa o sistema.
  }
  return 'system'
}

function resolve(pref: ThemePreference, systemDark: boolean): ResolvedTheme {
  return pref === 'system' ? (systemDark ? 'dark' : 'light') : pref
}

function apply(theme: ResolvedTheme): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', theme === 'dark' ? '#16181f' : '#fafbfd')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readPreference)
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches)
  const resolved = resolve(preference, systemDark)

  useEffect(() => {
    const mq = darkQuery()
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => apply(resolved), [resolved])

  const setPreference = useCallback((pref: ThemePreference, origin?: { x: number; y: number }) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, pref)
    } catch {
      // ignora: a escolha vale só para esta sessão
    }
    const next = resolve(pref, darkQuery().matches)
    const current: ResolvedTheme = document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light'
    if (next === current) {
      setPref(pref)
      return
    }
    const root = document.documentElement
    const x = origin?.x ?? window.innerWidth
    const y = origin?.y ?? 0
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    root.style.setProperty('--reveal-x', `${x}px`)
    root.style.setProperty('--reveal-y', `${y}px`)
    root.style.setProperty('--reveal-r', `${r}px`)
    withViewTransition(() => {
      flushSync(() => setPref(pref))
      apply(next)
    }, 'theme-switching')
  }, [])

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>')
  return ctx
}
