import type { ClaimLabel } from '@veritasai/core/domain'
import { LABEL_TEXT } from '@/lib/format.ts'
import { LABEL_TONE } from '@/lib/tones.ts'
import { cn } from '@/lib/utils'

/** Selo da afirmação: ícone + texto (não depende só da cor). */
export function LabelBadge({ label, className }: { label: ClaimLabel; className?: string }) {
  const tone = LABEL_TONE[label]
  const Icon = tone.icon
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        tone.soft,
        tone.text,
        tone.border,
        className,
      )}
    >
      <Icon className='size-3.5' aria-hidden='true' />
      {LABEL_TEXT[label].label}
    </span>
  )
}
