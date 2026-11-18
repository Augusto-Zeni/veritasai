/** Executa uma atualização de tela com a View Transitions API, se disponível e permitida. */
export function withViewTransition(update: () => void, className?: string): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduced) {
    update()
    return
  }
  const root = document.documentElement
  if (className) root.classList.add(className)
  const transition = document.startViewTransition(update)
  void transition.finished.finally(() => {
    if (className) root.classList.remove(className)
  })
}
