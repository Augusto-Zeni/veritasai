# Mapeamento dos rótulos das agências → classes do VeritasAI

O sistema classifica cada notícia em três classes. As agências de checagem usam escalas
próprias, então cada rótulo original (`rotulo_agencia`) é convertido para uma das três
classes (`rotulo_mapeado`) segundo a tabela abaixo.

| Classe do VeritasAI | Significado                                                                          |
| ------------------- | ------------------------------------------------------------------------------------ |
| **VERDADEIRO**      | O conteúdo central da notícia é correto e se sustenta nas evidências.                |
| **FALSO**           | O conteúdo central é incorreto, inventado ou foi desmentido.                         |
| **IMPRECISO**       | Mistura de correto e incorreto, exagero, falta de contexto ou informação distorcida. |

## Tabela de conversão

| Agência          | Rótulo original                                    | Classe      | Observação                                                                      |
| ---------------- | -------------------------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| Lupa             | Verdadeiro                                         | VERDADEIRO  |                                                                                 |
| Lupa             | Verdadeiro, mas                                    | IMPRECISO   | Verdadeiro com ressalva relevante                                               |
| Lupa             | Exagerado / Subestimado                            | IMPRECISO   | Número ou dimensão distorcidos                                                  |
| Lupa             | Contraditório                                      | IMPRECISO   |                                                                                 |
| Lupa             | Falso                                              | FALSO       |                                                                                 |
| Lupa             | Insustentável                                      | **excluir** | Não há dados públicos para decidir — ver nota 1                                 |
| Aos Fatos        | Verdadeiro                                         | VERDADEIRO  |                                                                                 |
| Aos Fatos        | Impreciso / Exagerado / Distorcido / Contraditório | IMPRECISO   |                                                                                 |
| Aos Fatos        | Falso                                              | FALSO       |                                                                                 |
| Aos Fatos        | Insustentável                                      | **excluir** | Ver nota 1                                                                      |
| Estadão Verifica | Verdadeiro / Comprovado                            | VERDADEIRO  |                                                                                 |
| Estadão Verifica | Enganoso / Fora de contexto                        | IMPRECISO   |                                                                                 |
| Estadão Verifica | Falso                                              | FALSO       |                                                                                 |
| Estadão Verifica | Sátira                                             | **excluir** | Não é alegação factual                                                          |
| UOL Confere      | Verdadeiro                                         | VERDADEIRO  |                                                                                 |
| UOL Confere      | Distorcido / Exagerado / Sem contexto              | IMPRECISO   |                                                                                 |
| UOL Confere      | Falso                                              | FALSO       |                                                                                 |
| AFP Checamos     | Verdadeiro                                         | VERDADEIRO  |                                                                                 |
| AFP Checamos     | Enganoso / Sem contexto / Parcialmente falso       | IMPRECISO   |                                                                                 |
| AFP Checamos     | Falso / Montagem                                   | FALSO       |                                                                                 |
| AFP Checamos     | Sátira                                             | **excluir** |                                                                                 |
| Comprova         | Comprovado                                         | VERDADEIRO  |                                                                                 |
| Comprova         | Enganoso / Contextualizando                        | IMPRECISO   | "Contextualizando" só se a peça tiver alegação central verificável — ver nota 2 |
| Comprova         | Falso                                              | FALSO       |                                                                                 |
| Comprova         | Sátira                                             | **excluir** |                                                                                 |

> ⚠ **Revisar antes de montar o dataset.** As escalas das agências mudam com o tempo e esta
> tabela foi montada a partir das escalas conhecidas até 2025. Confirme os rótulos vigentes
> no site de cada agência e registre aqui qualquer rótulo novo antes de usá-lo.

## Notas

1. **Insustentável** significa que não há dados para confirmar nem desmentir. Ele não equivale a
   FALSO, e tratá-lo como IMPRECISO misturaria "faltam dados" com "distorcido". Por isso fica fora
   do dataset.
2. **Contextualizando** (Comprova) nem sempre traz um veredito. Use o item apenas se a própria
   peça disser se a alegação central procede.
3. **Fonte da URL:** a coluna `url` deve apontar para a **notícia original** (o conteúdo verificado),
   não para a checagem. Posts de redes sociais costumam não ser extraíveis (exigem login); prefira
   conteúdos publicados em sites. O script de carga avisa quando `url` aponta para uma agência.
4. **Equilíbrio:** 20 notícias por classe; `split` = `calibracao` para 15 (5 por classe) e
   `teste` para 45 (15 por classe).

## Formato do `noticias.csv`

| Coluna            | Conteúdo                                            |
| ----------------- | --------------------------------------------------- |
| `id`              | identificador único (ex.: `N001`)                   |
| `url`             | notícia original (acessível publicamente)           |
| `titulo`          | título da notícia                                   |
| `data_publicacao` | AAAA-MM-DD                                          |
| `tema`            | ex.: saúde, política, economia, ciência, clima      |
| `agencia`         | agência que checou                                  |
| `url_checagem`    | link da checagem                                    |
| `rotulo_agencia`  | rótulo exatamente como a agência publicou           |
| `rotulo_mapeado`  | `VERDADEIRO`, `FALSO` ou `IMPRECISO` (tabela acima) |
| `split`           | `calibracao` ou `teste`                             |
