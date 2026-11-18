import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Aviso obrigatório (CLAUDE.md, seção 8). Aparece em todas as telas. */
export const DISCLAIMER_TEXT =
  'O resultado se baseia em evidências públicas disponíveis no momento da consulta. O modelo pode errar, ter vieses ou alucinar. Não substitui checagem profissional — consulte as fontes citadas.'

export function Disclaimer({ className }: { className?: string }) {
  return (
    <aside
      role='note'
      aria-label='Aviso sobre os resultados'
      className={cn(
        'flex gap-3 rounded-xl border bg-card/60 px-4 py-3 text-sm leading-relaxed text-muted-foreground backdrop-blur-sm',
        className,
      )}
    >
      <Info className='mt-0.5 size-4 shrink-0 text-primary' aria-hidden='true' />
      <p>{DISCLAIMER_TEXT}</p>
    </aside>
  )
}
