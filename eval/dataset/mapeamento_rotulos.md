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
| Lupa             | Contraditório                                      | **excluir** | Contradiz fala anterior do próprio autor, não o fato — ver nota 9               |
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

| Coluna            | Conteúdo                                                                      |
| ----------------- | ----------------------------------------------------------------------------- |
| `id`              | identificador único (ex.: `N001`)                                             |
| `url`             | notícia original (acessível publicamente); pode ficar vazia se houver `texto` |
| `titulo`          | título da notícia                                                             |
| `data_publicacao` | AAAA-MM-DD                                                                    |
| `tema`            | ex.: saúde, política, economia, ciência, clima                                |
| `agencia`         | agência que checou                                                            |
| `url_checagem`    | link da checagem                                                              |
| `rotulo_agencia`  | rótulo exatamente como a agência publicou                                     |
| `rotulo_mapeado`  | `VERDADEIRO`, `FALSO` ou `IMPRECISO` (tabela acima)                           |
| `split`           | `calibracao` ou `teste`                                                       |
| `texto`           | opcional: conteúdo verificado transcrito (ver nota 5)                         |

## Notas adicionadas em 2026-11-18 (montagem do dataset)

5. **Coluna `texto`.** Em 2026, quase todas as checagens tratam de vídeos e posts de redes
   sociais, que não são extraíveis por URL. Nesses casos, `texto` recebe o conteúdo viral **como
   circulou**, transcrito da própria checagem (a fala, a legenda do post ou a manchete), sem
   nenhuma parte da conclusão da agência. O pipeline usa esse texto no lugar da extração
   (`scrapeMethod = texto`). Se o link do post for conhecido, ele vai em `url` (o domínio é
   excluído da busca); se não, `url` fica vazia e o sistema usa uma origem fictícia
   `https://texto.invalid/<id>`.
6. **Falas checadas (Lupa).** As checagens de debates, sabatinas e entrevistas avaliam cada fala
   separadamente. Cada fala pode virar um item, com `texto` = quem falou, onde e quando + a fala
   entre aspas, e `rotulo_agencia` = o selo daquela fala.
7. **Mudanças de selos.** O Comprova aboliu as etiquetas (Falso, Enganoso, Comprovado...) em
   junho de 2025: peças posteriores não entram no dataset, a menos que a conclusão seja
   inequívoca, e nesse caso `rotulo_agencia` registra a frase da conclusão. Em 2026 o Aos Fatos
   publica praticamente só o selo FALSO (inclusive para conteúdo antigo recirculado como atual).
8. **Equilíbrio de formato.** Falas e posts têm estilos diferentes. Para que o sistema não acerte
   a classe pelo formato, cada classe deve misturar falas, posts e notícias de sites em proporções
   parecidas, e a proporção final de cada formato por classe deve ser relatada no TCC.
9. **Contraditório (Lupa)** indica que a fala contradiz outra declaração do mesmo autor, não que
   o fato esteja distorcido. Como o sistema verifica o fato com evidências externas, esses itens
   ficam fora do dataset (decisão de 2026-11-18; antes eram mapeados para IMPRECISO).
