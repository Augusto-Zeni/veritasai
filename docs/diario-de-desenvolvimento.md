# Diário de desenvolvimento

Registro de decisões, alternativas testadas e problemas encontrados (alimenta o Capítulo 4 do TCC).

| Data       | Decisão / ocorrência                                                                                                                     | Motivo                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17 | Monorepo com pnpm workspaces: `packages/core`, `apps/api`, `apps/web`, `eval`.                                                           | Separar o pipeline puro (reutilizado pela API e pela avaliação) das interfaces.                                                         |
| 2026-11-17 | `@veritasai/core` como pacote interno sem etapa de build (`exports` → `src/index.ts`), executado com `tsx` (API/avaliação) e Vite (web). | Menos configuração e nenhum artefato compilado para manter em sincronia.                                                                |
| 2026-11-17 | TypeScript fixado em 6.0 em vez do 7.0 (versão `latest`).                                                                                | O `typescript-eslint` ainda não suporta o TS 7 (compilador nativo); manter lint com regras tipadas pesa mais que o ganho de velocidade. |
| 2026-11-17 | Ambiente local em Node 26; projeto declara `engines: >=24` e `.nvmrc` = 24.                                                              | Node 24 LTS é a referência citada no texto; o código não depende de recursos exclusivos do 26.                                          |
| 2026-11-17 | pnpm instalado via `npm i -g pnpm@10`.                                                                                                   | O Corepack deixou de vir junto com o Node a partir da versão 25.                                                                        |
