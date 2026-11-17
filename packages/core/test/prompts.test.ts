import { describe, expect, it } from 'vitest'
import { PROMPT_IDS, promptVersions } from '../src/prompts/index.ts'
import { loadPrompt, parsePrompt, renderPrompt } from '../src/prompts/loader.ts'

const src = `---
id: teste
version: 3
---
<system>
Sistema {{a}}
</system>
<user>
Usuário {{ b }}
</user>
`

describe('prompts', () => {
  it('lê front-matter e blocos', () => {
    expect(parsePrompt(src)).toEqual({
      id: 'teste',
      version: '3',
      system: 'Sistema {{a}}',
      user: 'Usuário {{ b }}',
    })
  })

  it('rejeita prompt sem front-matter, sem versão ou sem blocos', () => {
    expect(() => parsePrompt('<system>x</system><user>y</user>')).toThrow(/front-matter/)
    expect(() => parsePrompt('---\nid: x\n---\n<system>x</system><user>y</user>')).toThrow(
      /version/,
    )
    expect(() => parsePrompt('---\nid: x\nversion: 1\n---\n<user>y</user>')).toThrow(/<system>/)
  })

  it('renderiza variáveis e acusa variável faltando ou sobrando', () => {
    const tpl = parsePrompt(src)
    expect(renderPrompt(tpl, { a: 1, b: 'dois' })).toEqual({
      promptId: 'teste',
      promptVersion: '3',
      system: 'Sistema 1',
      prompt: 'Usuário dois',
    })
    expect(() => renderPrompt(tpl, { a: 1 })).toThrow(/\{\{b\}\}/)
    expect(() => renderPrompt(tpl, { a: 1, b: 2, c: 3 })).toThrow(/não usadas: c/)
  })

  it('todos os prompts do pipeline carregam, com id igual ao nome do arquivo', () => {
    for (const id of PROMPT_IDS) {
      const tpl = loadPrompt(id)
      expect(tpl.id).toBe(id)
      expect(tpl.version).toMatch(/^\d+$/)
    }
    expect(Object.keys(promptVersions())).toEqual([...PROMPT_IDS])
  })

  it('o prompt de verificação manda usar apenas as evidências fornecidas', () => {
    expect(loadPrompt('verification').system).toMatch(/Use APENAS as evidências fornecidas/)
    expect(loadPrompt('verification').system).toMatch(/responda INSUFICIENTE/)
  })
})
