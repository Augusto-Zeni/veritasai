import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 32 32' aria-hidden='true' className={cn('size-8', className)}>
      <defs>
        <linearGradient id='veritas-logo' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0' stopColor='oklch(0.62 0.17 275)' />
          <stop offset='1' stopColor='oklch(0.48 0.18 268)' />
        </linearGradient>
      </defs>
      <rect width='32' height='32' rx='9' fill='url(#veritas-logo)' />
      <path
        d='M9.5 16.5l4.2 4.2 8.8-9.4'
        fill='none'
        stroke='white'
        strokeWidth='3'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

export function Logo() {
  return (
    <span className='flex items-center gap-2.5'>
      <LogoMark className='size-7 shadow-sm shadow-primary/20 rounded-[9px]' />
      <span className='text-[1.05rem] font-semibold tracking-tight'>
        Veritas<span className='text-primary'>AI</span>
      </span>
    </span>
  )
}
