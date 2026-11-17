import { describe, expect, it } from 'vitest'
import type { Claim, Evidence } from '../src/domain/schemas.ts'
import {
  NO_EVIDENCE_RATIONALE,
  VerificationService,
  formatEvidences,
} from '../src/services/verification.ts'
import { FakeLlm } from './fakes.ts'
import { fixture } from './helpers.ts'

const claim: Claim = { id: 'c2', text: 'Serão distribuídas 1,2 milhão de doses até março de 2024.' }
const evidences: Evidence[] = [
  {
    id: 'E1',
    url: 'https://gov.br/a',
    domain: 'gov.br',
    title: 'Vacinação contra a dengue',
    snippet: 'O ministério distribuirá 1,2 milhão de doses até março.',
    publishedAt: '2024-02-05',
  },
  {
    id: 'E2',
    url: 'https://x.com/b',
    domain: 'x.com',
    title: 'Outra',
    snippet: 'Trecho qualquer.',
  },
]

describe('VerificationService', () => {
  it('sem evidências responde INSUFICIENTE sem chamar o LLM', async () => {
    const llm = new FakeLlm([])
    expect(await new VerificationService(llm).verify(claim, [])).toEqual({
      label: 'INSUFICIENTE',
      rationale: NO_EVIDENCE_RATIONALE,
      evidenceIdsUsed: [],
    })
    expect(llm.requests).toHaveLength(0)
  })

  it('envia só a afirmação e as evidências, com temperatura 0', async () => {
    const llm = new FakeLlm([fixture('llm/verification.json')])
    await new VerificationService(llm).verify(claim, evidences)
    const req = llm.requests[0]!
    expect(req).toMatchObject({ promptId: 'verification', temperature: 0 })
    expect(req.prompt).toContain(`Afirmação: ${claim.text}`)
    expect(req.prompt).toContain(formatEvidences(evidences))
  })

  it('normaliza ids e descarta ids inventados', async () => {
    const llm = new FakeLlm([fixture('llm/verification.json')])
    const out = await new VerificationService(llm).verify(claim, evidences)
    expect(out).toEqual({
      label: 'SUPORTADA',
      rationale: expect.stringContaining('1,2 milhão') as unknown as string,
      evidenceIdsUsed: ['E1'],
    })
  })
})

describe('formatEvidences', () => {
  it('inclui id, domínio, título, data e trecho', () => {
    expect(formatEvidences(evidences)).toBe(
      '[E1] Fonte: gov.br — "Vacinação contra a dengue", publicada em 2024-02-05\n' +
        'O ministério distribuirá 1,2 milhão de doses até março.\n\n' +
        '[E2] Fonte: x.com — "Outra"\nTrecho qualquer.',
    )
  })
})
