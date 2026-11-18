import {
  FileText,
  Gauge,
  ListChecks,
  Lock,
  Scale,
  Search,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { LabelBadge } from '@/components/label-badge.tsx'
import { Card, CardContent } from '@/components/ui/card'

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
}) {
  return (
    <Card className='gap-0 py-0'>
      <CardContent className='flex flex-col gap-3 p-5 sm:p-6'>
        <h2 className='flex items-center gap-3 text-lg font-semibold tracking-tight'>
          <span className='flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground'>
            <Icon className='size-[1.1rem]' aria-hidden='true' />
          </span>
          {title}
        </h2>
        <div className='flex flex-col gap-3 leading-relaxed text-pretty text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground'>
          {children}
        </div>
      </CardContent>
    </Card>
  )
}

const PIPELINE: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: FileText,
    title: 'Extração do texto',
    text: 'O texto da notícia é extraído da página (Jina Reader, com o Readability como alternativa).',
  },
  {
    icon: ListChecks,
    title: 'Afirmações atômicas',
    text: 'Um modelo de linguagem (Google Gemini) divide o texto em até 10 afirmações factuais e autocontidas. Opiniões e previsões ficam de fora.',
  },
  {
    icon: Search,
    title: 'Busca de evidências',
    text: 'Para cada afirmação, uma busca na web em português; o site da própria notícia é excluído. Das páginas encontradas, são selecionados os trechos mais relevantes.',
  },
  {
    icon: Scale,
    title: 'Classificação',
    text: 'O modelo lê só a afirmação e os trechos encontrados e decide se as evidências a suportam, a contradizem ou não são suficientes.',
  },
]

export function AboutPage() {
  return (
    <div className='animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-6 duration-500'>
      <header className='flex flex-col gap-3'>
        <h1 className='text-3xl font-semibold tracking-tight sm:text-4xl'>Como funciona</h1>
        <p className='max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground'>
          O VeritasAI não julga a notícia como um bloco único. Ele a separa em afirmações menores e
          procura evidências públicas para cada uma, sempre mostrando as fontes.
        </p>
      </header>

      <ol className='relative flex flex-col gap-3'>
        {PIPELINE.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className='flex gap-4 rounded-2xl border bg-card/70 p-4 sm:p-5'>
            <span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30'>
              <Icon className='size-5' aria-hidden='true' />
            </span>
            <div>
              <h2 className='font-medium'>
                <span className='mr-2 text-muted-foreground tabular-nums'>{i + 1}.</span>
                {title}
              </h2>
              <p className='mt-1 text-sm leading-relaxed text-muted-foreground'>{text}</p>
            </div>
          </li>
        ))}
      </ol>

      <Section icon={Gauge} title='Como o veredito é calculado'>
        <p>Cada afirmação recebe um selo:</p>
        <div className='flex flex-wrap gap-2'>
          <LabelBadge label='SUPORTADA' />
          <LabelBadge label='CONTRADITA' />
          <LabelBadge label='INSUFICIENTE' />
        </div>
        <p>
          Com <strong>N</strong> afirmações, das quais <strong>nₛ</strong> suportadas e{' '}
          <strong>n꜀</strong> contraditas, calculamos:
        </p>
        <ul className='flex flex-col gap-2 overflow-x-auto rounded-xl bg-muted/60 p-4 font-mono text-xs whitespace-nowrap text-foreground sm:text-sm'>
          <li>cobertura c = (nₛ + n꜀) / N</li>
          <li>equilíbrio s = (nₛ − n꜀) / (nₛ + n꜀)</li>
        </ul>
        <p>
          A notícia é <strong>verdadeira</strong> quando a cobertura é suficiente e o equilíbrio
          pende para as afirmações suportadas; <strong>falsa</strong> quando a cobertura é
          suficiente e o equilíbrio pende para as contraditas; e <strong>imprecisa</strong> nos
          demais casos. Os limiares usados aparecem nos “Detalhes técnicos” de cada resultado.
        </p>
      </Section>

      <Section icon={ShieldAlert} title='Limitações'>
        <ul className='flex list-disc flex-col gap-2 pl-5'>
          <li>
            O resultado depende do que estiver publicado e acessível na web no momento da consulta.
            Fatos muito recentes ou pouco noticiados tendem a ficar sem evidência.
          </li>
          <li>
            Modelos de linguagem podem errar, ter vieses ou “alucinar”. Por isso cada selo mostra as
            fontes usadas: confira-as.
          </li>
          <li>
            Sites com paywall ou que bloqueiam leitura automática podem não ser lidos por completo.
          </li>
          <li>
            Notícias longas são analisadas só até um limite de caracteres, e no máximo 10 afirmações
            por notícia.
          </li>
          <li>A ferramenta não substitui o trabalho de agências profissionais de checagem.</li>
        </ul>
      </Section>

      <Section icon={Lock} title='Privacidade'>
        <p>
          Não há cadastro, login, cookies de rastreamento nem registro de endereço IP. Guardamos
          apenas o resultado da verificação de cada link, para não repetir consultas às APIs. A
          preferência de tema fica só no seu navegador.
        </p>
      </Section>

      <p className='text-center text-sm text-muted-foreground'>
        Projeto de Trabalho de Conclusão de Curso de Augusto Zeni — Engenharia de Software,
        Univates. Orientador: Prof. Me. Edson Moacir Ahlert.
      </p>
    </div>
  )
}
