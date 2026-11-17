# CLAUDE.md — VeritasAI

> Contexto para o Claude Code trabalhar neste repositório. Leia este arquivo inteiro antes de qualquer tarefa.

## 1. O que é este projeto

**VeritasAI** é o software do TCC II de Augusto Zeni (Engenharia de Software, Univates, orientador Prof. Me. Edson Moacir Ahlert).
É um pipeline de **verificação automatizada de notícias em português**:

```
URL da notícia
  → Scraper (extrai o texto do artigo)
  → ClaimExtraction (LLM decompõe em afirmações atômicas verificáveis)
  → para cada afirmação:
        QueryGeneration (LLM gera consulta de busca)
        Search (busca na web → lista de URLs)
        Evidence (lê as páginas e seleciona trechos relevantes — RAG)
        Verification (LLM classifica: SUPORTADA | CONTRADITA | INSUFICIENTE)
  → Scoring (agrega → VERDADEIRO | FALSO | IMPRECISO)
  → Explicação + afirmações + evidências com links
```

O TCC segue o formato **Monografia Acadêmica**. A pergunta de pesquisa é:
*como automatizar a verificação de notícias em português com um pipeline de afirmações atômicas + recuperação dinâmica de evidências + LLM?*
**Hipótese:** decompor em afirmações atômicas e buscar evidências para cada uma produz vereditos mais precisos que tratar o texto como bloco único.

### Por que isso importa para o código
O código não é só um produto: ele **gera as evidências do Capítulo 5 (Testes e análise dos resultados)**. Portanto:
- todo experimento precisa ser **reproduzível** (prompts versionados, configuração salva junto com o resultado, cache de respostas);
- o pipeline precisa rodar em **modo avaliação** (lote de notícias → métricas), não só pela interface web;
- a hipótese precisa ser testável → o sistema precisa ter **baselines/ablação** (seção 7).

## 2. Restrições de projeto (não negociáveis)

1. **Nenhum dado de usuário.** Sem cadastro, login, contas, cookies de rastreamento ou armazenamento de IP. Não criar tabelas/coleções de usuários.
2. **Banco de dados não é obrigatório.** A persistência permitida é apenas:
   - cache de verificações por URL normalizada (economizar cota de API) e cache de respostas de LLM/busca (reprodutibilidade);
   - artefatos de avaliação em arquivos (`eval/runs/`).
   Começar com **cache em arquivo/SQLite local** (`better-sqlite3`) atrás de uma interface `CacheStore`. **Não usar PostgreSQL/pgvector** a menos que surja uma necessidade real (ex.: busca por similaridade entre verificações) — e, se surgir, perguntar ao Augusto antes.
3. **Transparência:** toda classificação precisa carregar as evidências (trecho + URL + título + domínio) que a sustentam. Nunca devolver veredito sem fontes.
4. **Aviso permanente na interface** (ver seção 8).
5. **Custo:** as APIs têm cotas gratuitas pequenas e que mudam sem aviso. Nunca chamar API real em testes automatizados; sempre respeitar rate limit com fila + retry.

## 3. Stack

| Camada | Tecnologia | Observação |
|---|---|---|
| Linguagem | TypeScript (strict) | executado no runtime **Node.js 24 LTS** (Node é runtime, não linguagem) |
| Monorepo | pnpm workspaces | |
| API | Fastify 5 | progresso do pipeline via **SSE** |
| Frontend | React + Vite | Tailwind para estilo |
| Validação | Zod | toda saída de LLM é validada com Zod |
| LLM | Google Gemini via `@google/genai` | modelo vem de `GEMINI_MODEL`; provider atrás de interface `LlmClient` |
| Busca | Serper.dev | atrás de interface `SearchClient` |
| Extração de texto | Jina Reader (`r.jina.ai`) com API key | fallback: `@mozilla/readability` + `jsdom` |
| Cache | SQLite (`better-sqlite3`) | arquivo em `data/cache.sqlite` (gitignored) |
| Testes | Vitest | com fixtures gravadas, sem rede |
| Concorrência | `p-limit` + backoff exponencial | tratar 429 |

**Atenção sobre o Gemini:** os limites do plano gratuito foram reduzidos várias vezes desde dez./2025 e o Google não publica mais números fixos por modelo. Não presumir "15 RPM / 1M tokens/dia" (valor citado no TCC I, já desatualizado). Ler limites de `LLM_RPM` / `LLM_RPD` no `.env` e registrar o consumo real de tokens por execução (isso vira dado do TCC: custo por notícia).

## 4. Estrutura de pastas

```
veritasai/
├── CLAUDE.md
├── packages/
│   └── core/                 # pipeline puro, sem HTTP — usado pela API e pela avaliação
│       ├── src/
│       │   ├── domain/       # tipos e schemas Zod (Claim, Evidence, Verdict...)
│       │   ├── services/     # Scraper, ClaimExtraction, QueryGeneration, Search, Evidence, Verification, Scoring
│       │   ├── clients/      # LlmClient (gemini), SearchClient (serper), ReaderClient (jina)
│       │   ├── cache/        # CacheStore (sqlite, memory)
│       │   ├── prompts/      # prompts em .md com versão no front-matter
│       │   ├── config.ts     # limiares, listas de domínios, flags
│       │   └── pipeline.ts   # orquestração + eventos de progresso
│       └── test/fixtures/    # respostas gravadas de LLM/busca/scraper
├── apps/
│   ├── api/                  # Fastify: POST /verify, GET /verify/:id/stream (SSE), GET /health
│   └── web/                  # React + Vite
├── eval/
│   ├── dataset/              # noticias.csv (gabarito), mapeamento_rotulos.md
│   ├── scripts/              # run.ts, metrics.ts, calibrate.ts, sample-claims.ts, kappa.ts
│   └── runs/<timestamp>_<variante>/   # saída de cada execução (versionada no git)
└── docs/
    ├── diagramas/            # Mermaid/PlantUML: arquitetura, sequência, classes, casos de uso
    └── telas/                # capturas de tela para o texto do TCC
```

## 5. Modelo de domínio (tipos centrais)

```ts
type ClaimLabel = 'SUPORTADA' | 'CONTRADITA' | 'INSUFICIENTE';
type NewsVerdict = 'VERDADEIRO' | 'FALSO' | 'IMPRECISO';

interface Article   { url: string; domain: string; title?: string; publishedAt?: string; text: string; }
interface Claim     { id: string; text: string; sourceSentence?: string; }
interface Evidence  { url: string; domain: string; title: string; snippet: string; publishedAt?: string; }
interface ClaimResult {
  claim: Claim; query: string; evidences: Evidence[];
  label: ClaimLabel; rationale: string;          // justificativa curta do LLM
}
interface VerificationResult {
  article: Article; claims: ClaimResult[];
  score: number | null;   // s = (n_s - n_c) / (n_s + n_c), em [-1, 1]; null se n_s + n_c = 0
  coverage: number;       // c = (n_s + n_c) / N, em [0, 1]
  verdict: NewsVerdict; explanation: string;
  meta: RunMeta;          // modelo, versões dos prompts, config, tokens, latência por etapa, timestamp
}
```

Não há modelo ER de usuários. Se o cache SQLite for usado, as tabelas são só: `verification_cache(url_hash, result_json, created_at, config_hash)` e `llm_cache(prompt_hash, model, response_json, created_at)`.

## 6. Regras do pipeline

### Scraper
- Normalizar URL (remover `utm_*`, fragmentos) antes de cachear.
- Jina Reader primeiro; se falhar ou retornar < 500 caracteres, tentar Readability. Registrar qual método foi usado.
- Truncar texto em `MAX_ARTICLE_CHARS` (config) e registrar se houve truncamento.

### ClaimExtraction
- Saída JSON validada por Zod. Máximo `MAX_CLAIMS` (padrão 10) afirmações por notícia.
- Cada afirmação deve ser **autocontida** (resolver pronomes, incluir sujeito, data e local quando existirem no texto) e **factual** (descartar opinião, previsão, citação de opinião).
- Afirmações em português.

### Search / Evidence
- Consultas em português, `gl=br`, `hl=pt-br`.
- **Excluir sempre o domínio da própria notícia** (evita autoconfirmação).
- **Modo avaliação — vazamento de gabarito:** as notícias do conjunto de teste vêm de checagens de agências (Lupa, Aos Fatos, Estadão Verifica, UOL Confere, AFP Checamos, Comprova etc.). Se a busca encontrar a própria checagem, o sistema "cola" a resposta. Implementar a flag `EXCLUDE_FACTCHECK_DOMAINS` (lista em `config.ts`) e rodar a avaliação **com e sem** essa exclusão. Os dois resultados são relatados no TCC.
- Buscar top `SEARCH_TOP_K` (padrão 5); ler no máximo `EVIDENCE_PAGES` páginas por afirmação; selecionar até 3 trechos por página.
- Opcional: lista de domínios confiáveis (`TRUSTED_DOMAINS`) para priorizar resultados — registrar no `meta` se foi usada.

### Verification
- Prompt recebe **somente** a afirmação + trechos de evidência. Instruir explicitamente: "use apenas as evidências fornecidas; se não forem suficientes, responda INSUFICIENTE".
- `temperature: 0`. Saída: `{ label, rationale, evidenceIdsUsed[] }`.

### Scoring
- Fórmulas acima. Limiares em `config.ts` (não hardcoded): `COVERAGE_MIN = 0.5` (≥ 50% das afirmações com evidência), `TRUE_MIN = 0.5`, `FALSE_MAX = -0.3`.
- VERDADEIRO se `c ≥ COVERAGE_MIN && s ≥ TRUE_MIN`; FALSO se `c ≥ COVERAGE_MIN && s ≤ FALSE_MAX`; senão IMPRECISO.
- Implementar como função pura com testes unitários cobrindo todas as fronteiras.

### Prompts
- Ficam em `packages/core/src/prompts/*.md` com front-matter `id` e `version`. Qualquer alteração de texto → incrementar `version`. A versão vai para `meta` de cada resultado.

## 7. Avaliação (gera o Capítulo 5 do TCC)

### Dataset — `eval/dataset/noticias.csv`
Colunas: `id, url, titulo, data_publicacao, tema, agencia, url_checagem, rotulo_agencia, rotulo_mapeado, split`
- 60 notícias (20 por classe), 2024–2026, temas variados, URL pública acessível.
- `rotulo_mapeado` ∈ {VERDADEIRO, FALSO, IMPRECISO} conforme `mapeamento_rotulos.md`.
- `split` ∈ {calibracao, teste}: **calibrar os limiares só no split de calibração** (ex.: 15 notícias) e reportar métricas finais no split de teste (45). Calibrar e avaliar no mesmo conjunto invalida o resultado.

### Variantes (ablação — testa a hipótese)
`eval/scripts/run.ts --variant <nome>`:
| Variante | O que faz | Para que serve |
|---|---|---|
| `full` | pipeline completo | sistema proposto |
| `no-decomposition` | artigo inteiro → 1 busca → 1 verificação | testa a hipótese da decomposição |
| `no-retrieval` | LLM julga o artigo só com conhecimento interno | mede o ganho do RAG / risco de alucinação |
| `full-no-factcheck-domains` | `full` + exclusão das agências | controla vazamento de gabarito |

### Saídas de cada execução — `eval/runs/<timestamp>_<variante>/`
- `config.json` (config + versões de prompts + modelo + commit git)
- `results.jsonl` (um `VerificationResult` por notícia)
- `metrics.json` e `metrics.md`: acurácia, precisão / revocação / F1 por classe, macro-F1, matriz de confusão 3×3
- `costs.json`: tokens, nº de chamadas por API, latência média e p95 por etapa
- `errors.md`: lista de discordâncias com link para análise qualitativa

### Nível da afirmação
- `sample-claims.ts` sorteia 100 afirmações (seed fixa) → CSV para rotulação manual pelo Augusto.
- `kappa.ts` calcula acurácia e **Kappa de Cohen** entre sistema e rotulação manual.

### Referências de comparação (para a discussão)
- 60% — acerto médio de pessoas ao julgar veracidade (OCDE, 2024)
- 70% — Ghadiri et al. (2022)
- Distribuição de classes (33% = chute uniforme em 3 classes)

## 8. Frontend (apps/web)

Telas (cada uma vai virar figura no TCC — manter visual limpo):
1. **Início:** campo de URL + botão "Verificar" + aviso.
2. **Progresso:** etapas do pipeline em tempo real via SSE (extraindo texto → extraindo afirmações → buscando evidências (n/N) → classificando → agregando).
3. **Resultado:** veredito com cor e ícone (não depender só da cor), score e cobertura em linguagem simples ("7 de 9 afirmações tiveram evidências"), explicação, lista de afirmações com selo, evidências expansíveis com link.
4. **Sobre / Como funciona:** explicação do método e das limitações.

**Aviso permanente** (texto obrigatório): o resultado se baseia em evidências públicas disponíveis no momento da consulta; o modelo pode errar, ter vieses ou alucinar; não substitui checagem profissional; consulte as fontes citadas.

Acessibilidade: contraste AA, navegação por teclado, layout responsivo (uso principal: celular).

## 9. Comandos

```bash
pnpm install
pnpm dev                 # api + web
pnpm test                # vitest (sem rede)
pnpm lint && pnpm typecheck
pnpm eval:run -- --variant full --split teste
pnpm eval:metrics -- eval/runs/<pasta>
pnpm eval:calibrate -- --split calibracao
pnpm eval:sample-claims -- --run eval/runs/<pasta> --n 100 --seed 42
```

## 10. Variáveis de ambiente (`.env`, nunca commitar)

```
GEMINI_API_KEY=
GEMINI_MODEL=            # ex.: o Flash vigente; confirmar em ai.google.dev
SERPER_API_KEY=
JINA_API_KEY=
LLM_RPM=5
LLM_RPD=100
MAX_ARTICLE_CHARS=20000
MAX_CLAIMS=10
SEARCH_TOP_K=5
EVIDENCE_PAGES=3
EXCLUDE_FACTCHECK_DOMAINS=false
CACHE_PATH=./data/cache.sqlite
```

## 11. Convenções de código

- Identificadores em inglês; textos de UI, prompts e mensagens ao usuário em português.
- Serviços recebem dependências por construtor (injeção simples) para permitir mocks.
- Nada de `any`. Erros de serviços externos viram erros tipados (`ScrapeError`, `LlmQuotaError`...) e o pipeline degrada com elegância (ex.: falha numa afirmação → INSUFICIENTE com motivo registrado, não derruba a notícia).
- Logs estruturados (pino, já vem com Fastify). Não logar o texto completo das notícias em produção.
- Commits pequenos e descritivos em português (`feat(core): ...`, `fix(eval): ...`).

## 12. Como trabalhar comigo (Claude)

- Antes de implementar algo grande, proponha o plano em poucos passos.
- Ao terminar uma funcionalidade, rode `pnpm test && pnpm typecheck`.
- Ao mudar prompt, limiar ou lógica de scoring, avise que **resultados de avaliação anteriores deixam de ser comparáveis**.
- Quando algo puder virar conteúdo do TCC (decisão de arquitetura, alternativa testada e descartada, problema encontrado), registre uma linha em `docs/diario-de-desenvolvimento.md` com data, decisão e motivo. Esse diário alimenta o Capítulo 4 do texto (o orientador pediu "relatos de experimentação das ferramentas").
- Gere diagramas em Mermaid em `docs/diagramas/` quando a arquitetura mudar (arquitetura de componentes, sequência de uma verificação, classes do domínio, casos de uso).
- Não adicionar dependências pesadas sem justificar. Não adicionar autenticação nem banco relacional sem perguntar.

## 13. Ordem de implementação sugerida

1. Monorepo + config + tipos de domínio + `Scoring` com testes (função pura).
2. Clients (Gemini, Serper, Jina) + cache + rate limit.
3. Serviços do pipeline um a um, cada um com teste usando fixtures.
4. `pipeline.ts` + CLI `pnpm verify <url>` para testar sem frontend.
5. Dataset + `eval/scripts` + variantes de ablação.
6. API Fastify + SSE.
7. Frontend.
8. Rodar avaliação completa, calibrar, rodar teste final, gerar figuras/tabelas.
