import { CircleAlert, CircleCheck, CircleHelp, CircleX, type LucideIcon } from 'lucide-react'
import type { ClaimLabel, NewsVerdict } from '@veritasai/core/domain'

/** Classes de cor por tom (strings literais para o Tailwind encontrar). */
export interface Tone {
  text: string
  soft: string
  border: string
  solid: string
  icon: LucideIcon
}

const success: Omit<Tone, 'icon'> = {
  text: 'text-success-strong',
  soft: 'bg-success-soft',
  border: 'border-success/30',
  solid: 'bg-success',
}
const danger: Omit<Tone, 'icon'> = {
  text: 'text-danger-strong',
  soft: 'bg-danger-soft',
  border: 'border-danger/30',
  solid: 'bg-danger',
}
const warning: Omit<Tone, 'icon'> = {
  text: 'text-warning-strong',
  soft: 'bg-warning-soft',
  border: 'border-warning/40',
  solid: 'bg-warning',
}
const neutral: Omit<Tone, 'icon'> = {
  text: 'text-neutral-strong',
  soft: 'bg-neutral-soft',
  border: 'border-neutral/30',
  solid: 'bg-neutral',
}

export const VERDICT_TONE: Record<NewsVerdict, Tone> = {
  VERDADEIRO: { ...success, icon: CircleCheck },
  FALSO: { ...danger, icon: CircleX },
  IMPRECISO: { ...warning, icon: CircleAlert },
}

export const LABEL_TONE: Record<ClaimLabel, Tone> = {
  SUPORTADA: { ...success, icon: CircleCheck },
  CONTRADITA: { ...danger, icon: CircleX },
  INSUFICIENTE: { ...neutral, icon: CircleHelp },
}
