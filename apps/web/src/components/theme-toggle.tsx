import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme, type ThemePreference } from '@/lib/theme.tsx'

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Automático (sistema)', icon: Monitor },
]

export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme()
  const buttonRef = useRef<HTMLButtonElement>(null)

  const origin = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={buttonRef}
          variant='ghost'
          size='icon'
          className='relative rounded-full'
          aria-label={`Tema: ${resolved === 'dark' ? 'escuro' : 'claro'}. Alterar tema`}
        >
          <Sun className='size-[1.15rem] scale-100 rotate-0 transition-transform duration-500 dark:scale-0 dark:-rotate-90' />
          <Moon className='absolute size-[1.15rem] scale-0 rotate-90 transition-transform duration-500 dark:scale-100 dark:rotate-0' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='min-w-52'>
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setPreference(value, origin())}>
            <Icon />
            <span className='flex-1'>{label}</span>
            {preference === value && <Check className='text-primary' aria-label='selecionado' />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
