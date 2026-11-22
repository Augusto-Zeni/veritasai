"""Capítulo 5 (testes e resultados), Capítulo 6 (conclusões) e apêndices."""
import re
from results import LABELS, mcnemar_exact

VNAME = {"full": "Completo (full)", "full-no-factcheck-domains": "Sem agências", "no-decomposition": "Sem decomposição",
         "no-retrieval": "Sem recuperação"}


def pct(x, d=1):
    return f"{x * 100:.{d}f}".replace(".", ",") + "%"


def num(x, d=3):
    return f"{x:.{d}f}".replace(".", ",")


def intfmt(x):
    return f"{x:,}".replace(",", ".")


def test_runs(R):
    return {
        "full": R.get(("full", "teste", "2")),
        "full-no-factcheck-domains": R.get(("full-no-factcheck-domains", "teste", "2")),
        "no-decomposition": R.get(("no-decomposition", "teste", None)),
        "no-retrieval": R.get(("no-retrieval", "teste", None)),
    }


def confusion_table(m, run, title):
    c = run["cls"]["confusion"]
    rows = [[f"**{e}**"] + [str(c[e][p]) for p in LABELS] + [str(sum(c[e].values()))] for e in LABELS]
    rows.append(["**Total previsto**"] + [str(sum(c[e][p] for e in LABELS)) for p in LABELS] + [str(run["n"])])
    m.table("Tabela", title, ["Gabarito \\ Sistema"] + LABELS + ["Total"], rows,
            "Elaborado pelo autor (2026), a partir de `eval/runs`.", widths=[4.0, 2.8, 2.4, 2.8, 1.8])


def cap5(m, R, D, T):
    """R: resultados; D: estatísticas do dataset; T: textos de discussão (dict) escritos após os resultados."""
    P = m.para
    TR = test_runs(R)
    t = lambda k: T.get(k, f"[DISCUSSÃO PENDENTE: {k}]")
    m.h1("5 TESTES E ANÁLISE DOS RESULTADOS")
    P("Este capítulo apresenta os testes de software, o protocolo experimental, a calibração, os resultados "
      "obtidos no conjunto de teste e a sua análise frente às hipóteses H1 e H2. Todos os números foram "
      "gerados pelos scripts do diretório `eval/` e podem ser reproduzidos a partir dos artefatos gravados "
      "em `eval/runs/`, que incluem a configuração, as versões dos prompts e o commit de cada execução.")

    # ------------------------------------------------------------------ 5.1
    m.h2("5.1 Testes de software")
    P(f"O sistema possui {D['tests']} testes automatizados, distribuídos em {D['test_files']} arquivos, executados "
      "com o Vitest sem acesso à rede. Os serviços externos são substituídos por implementações falsas, e as "
      "respostas reais do LLM, da Serper e do Jina são reproduzidas a partir de gravações. O Quadro 8 resume "
      "o que é coberto.")
    m.table("Quadro", "Cobertura dos testes automatizados",
            ["Componente", "O que é verificado"],
            [["Agregação (scoring)", "Todas as fronteiras dos limiares (s = 0,5; s = −0,3; c = 0,5), N = 0, "
                                    "só INSUFICIENTES, tolerância de ponto flutuante."],
             ["Serviços do pipeline", "Validação das saídas do LLM, limite de afirmações, consulta de reserva, "
                                     "exclusão de domínios, BM25 e filtro de relevância, descarte de ids inventados."],
             ["Clientes e cache", "Repetição com espera, 429 por minuto e por dia, cache de respostas válidas, não "
                                 "armazenamento de respostas inválidas."],
             ["Pipeline e variantes", "Degradação elegante (falha em uma afirmação), eventos de progresso, baselines."],
             ["Avaliação", "Leitura do dataset, métricas, Kappa, calibração em grade, sorteio com semente."],
             ["API e interface", "Rotas, SSE com reconexão, fila, filtro de SSRF; redutor de estado dos eventos."],
             ["Regressão", "`fetch` global do Node.js após carregar o leitor (seção 4.3.4); domínio atual da Lupa."]],
            "Elaborado pelo autor (2026).", widths=[3.8, 11.4], align_center_from=9)
    P("Os testes automatizados não substituem os testes com os serviços reais, como mostrou o defeito do "
      "`fetch` global, invisível com respostas gravadas. Por isso, antes de cada avaliação foi executado um "
      "teste de fumaça com um item. Durante a preparação do experimento, a revisão da configuração revelou "
      "ainda que a lista de domínios de checagem continha o endereço antigo da Lupa (`lupa.uol.com.br`), mas "
      "não o atual (`agencialupa.org`), justamente o domínio das checagens do gabarito. Sem a correção, a "
      "variante que deveria excluir as agências continuaria encontrando a resposta. O domínio foi incluído, "
      "com um teste de regressão, antes da execução dessa variante.")

    # ------------------------------------------------------------------ 5.2
    m.h2("5.2 Protocolo experimental")
    m.h3("5.2.1 Conjunto de avaliação")
    P("O planejamento do TCC I previa 60 notícias publicadas em sites, com URL pública, verificadas por "
      "agências. Para construí-lo, foram coletadas automaticamente 579 checagens publicadas em 2026 por Aos "
      "Fatos, Lupa, Estadão Verifica e UOL Confere. A coleta revelou que quase todas desmentiam vídeos e "
      "publicações em redes sociais, cujo conteúdo não é extraível sem autenticação; apenas cerca de cinco "
      "apontavam para uma página de notícia legível, e praticamente nenhuma tinha o rótulo Verdadeiro. Esse "
      "achado confirma, por outra via, a migração da desinformação para as redes sociais (seção 2.1) e "
      "tornava inviável um conjunto balanceado de notícias por URL.")
    P("O conjunto foi então construído a partir das checagens de **declarações públicas** da Lupa (falas de "
      "candidatos e autoridades em debates, entrevistas e discursos), um formato em que a agência publica "
      "as três classes com frequência semelhante. Cada item contém o texto da fala, com a atribuição (quem "
      "falou, cargo, ocasião e data), transcrito da checagem; a conclusão da agência não faz parte do texto. "
      "O sistema recebe esse texto pela entrada alternativa (RF01). Os critérios foram: checagem publicada "
      "entre 2024 e 2026; fala com pelo menos 120 caracteres; no máximo três falas por pessoa por classe; sem "
      "duplicatas; e exclusão das listas de mitos, cujo texto explicativo revelaria a resposta. Os rótulos "
      "foram mapeados para as três classes do sistema (Quadro 9; tabela completa no Apêndice B).")
    m.table("Quadro", "Mapeamento dos selos da Lupa para as classes do VeritasAI",
            ["Selo da Lupa", "Classe", "Justificativa"],
            [["Verdadeiro", "VERDADEIRO", "O conteúdo central é correto."],
             ["Exagerado, Subestimado, Verdadeiro, mas", "IMPRECISO", "Fato correto com número ou dimensão "
                                                                    "distorcidos, ou ressalva relevante."],
             ["Falso", "FALSO", "O conteúdo central é incorreto."],
             ["Insustentável", "excluído", "Faltam dados públicos; não equivale a FALSO nem a IMPRECISO."],
             ["Contraditório", "excluído", "Contradiz fala anterior do próprio autor, não o fato."]],
            "Elaborado pelo autor (2026).", widths=[4.8, 2.8, 7.6], align_center_from=1)
    P(f"Dos 81 candidatos sorteados com semente fixa (42), foram usados 60, 20 por classe, e os demais "
      f"ficaram como reserva. A partição de **calibração** tem 15 itens (5 por classe) e a de **teste**, 45 "
      f"(15 por classe). Os textos têm mediana de {D['len_median']} caracteres (mínimo {D['len_min']}, máximo "
      f"{D['len_max']}), {D['speakers']} autores distintos e datas de 2024 ({D['y2024']}), 2025 ({D['y2025']}) e "
      f"2026 ({D['y2026']}). A Tabela 1 mostra a distribuição por tema.")
    m.table("Tabela", "Distribuição dos itens por tema e partição",
            ["Tema", "Calibração", "Teste", "Total"], D["tema_rows"],
            "Elaborado pelo autor (2026), a partir de `eval/dataset/noticias.csv`.", widths=[5, 3, 3, 3], bold_last_row=True)
    P("O formato tem duas consequências que precisam ser declaradas. A primeira é favorável à validade "
      "interna: as três classes têm o mesmo formato, o que impede o sistema de acertar pelo estilo do texto. "
      "A segunda limita a validade externa: as falas são curtas e costumam conter poucas afirmações, o que "
      "reduz o espaço para a decomposição mostrar vantagem sobre a verificação do texto inteiro. Essa "
      "limitação foi registrada antes da execução do experimento e é considerada na análise de H1.")

    m.h3("5.2.2 Variantes")
    P("O experimento compara quatro variantes do sistema sobre os mesmos 45 itens de teste (Quadro 10). "
      "Todas usam o mesmo modelo, os mesmos limiares e o mesmo cache de buscas, de modo que a única "
      "diferença entre elas é o componente manipulado.")
    m.table("Quadro", "Variantes avaliadas no experimento",
            ["Variante", "O que faz", "Finalidade"],
            [["Completo (full)", "Pipeline completo do Capítulo 4.", "Sistema proposto."],
             ["Sem agências", "Completo, excluindo da busca os domínios de agências de checagem (Quadro 6).",
              "Controlar o vazamento de gabarito."],
             ["Sem decomposição", "O texto inteiro gera uma busca e uma verificação, que classifica diretamente em "
                                  "VERDADEIRO, FALSO ou IMPRECISO.", "Testar H1."],
             ["Sem recuperação", "O LLM julga o texto apenas com seu conhecimento interno.", "Testar H2 e medir o "
                                                                                          "risco de alucinação."]],
            "Elaborado pelo autor (2026).", widths=[3.2, 7.6, 4.4], align_center_from=9)
    P("O **vazamento de gabarito** merece atenção. Como todos os itens vêm de checagens da Lupa, a busca na "
      "web pode encontrar a própria checagem e o sistema, em vez de verificar, apenas copiaria a conclusão "
      "da agência. Isso não é erro do sistema em uso real, pois encontrar uma checagem existente é útil ao "
      "cidadão, mas inflaria artificialmente as métricas. Por isso, os resultados são relatados com e sem a "
      "exclusão dos domínios de agências, e a variante sem agências é tomada como a medida mais conservadora "
      "do desempenho do método.")

    m.h3("5.2.3 Procedimento e métricas")
    P("O procedimento seguiu quatro passos: (1) executar a variante completa na partição de calibração; (2) "
      "calibrar os limiares de agregação nessa partição por busca em grade, 700 combinações de "
      "COVERAGE_MIN, TRUE_MIN e FALSE_MAX, maximizando o F1 macro, com desempate pela acurácia e, depois, "
      "pela proximidade dos valores iniciais; (3) congelar prompts, modelo e limiares; e (4) executar as "
      "quatro variantes uma única vez na partição de teste. Calibrar e avaliar no mesmo conjunto "
      "superestimaria o desempenho; o script de calibração recusa executar fora da partição de calibração.")
    P("São relatados a acurácia, com intervalo de confiança de 95% pelo método de Wilson (Wilson, 1927), a "
      "precisão, a revocação e o F1 por classe, o F1 macro e a matriz de confusão. As hipóteses são testadas "
      "pelo teste de McNemar exato e bilateral, com nível de significância de 5%. Como referências de "
      "comparação, adotam-se: 33,3%, o acerto esperado ao escolher uma classe ao acaso entre três, igual ao "
      "de responder sempre a mesma classe, já que as classes são balanceadas; 60%, o acerto médio de pessoas "
      "ao julgar a veracidade de notícias (Jornal da USP, 2024); e 70%, a acurácia de Ghadiri *et al.* "
      "(2022). As comparações com as duas últimas são apenas indicativas, pois foram obtidas em tarefas e "
      "conjuntos de dados diferentes.")

    # ------------------------------------------------------------------ 5.3
    m.h2("5.3 Calibração e a revisão do prompt de extração")
    c1 = R.get(("full", "calibracao", "1")); c2 = R.get(("full", "calibracao", "2"))
    if c1 and c2:
        P(f"A primeira execução na partição de calibração, com a versão 1 do prompt de extração, obteve "
          f"acurácia de {pct(c1['cls']['accuracy'])} e F1 macro de {num(c1['cls']['macroF1'])}, mas com um "
          f"padrão revelador: o sistema nunca previu FALSO (revocação {pct(c1['cls']['perClass']['FALSO']['recall'], 0)}) "
          f"e classificou {c1['cls']['confusion']['FALSO']['VERDADEIRO']} das 5 falas falsas como VERDADEIRO. A "
          "inspeção das afirmações extraídas mostrou a causa. A regra que tratava “X afirmou que Y” como "
          "fato sobre a declaração, adequada a notícias, fazia o sistema verificar o **contexto** da fala, e "
          "não o seu **conteúdo**. Para a fala de um senador em entrevista, foram extraídas afirmações como "
          "“Flávio Bolsonaro é senador pelo PL-RJ” e “Flávio Bolsonaro concedeu entrevista à "
          "GloboNews no dia 14 de maio de 2026”, ambas verdadeiras e facilmente confirmadas, enquanto o "
          "conteúdo checado pela agência aparecia como “Flávio Bolsonaro afirmou que...” e terminava "
          "INSUFICIENTE, pois nenhuma fonte registrava a fala nesses termos. O veredito agregado ficava, assim, "
          "enviesado para VERDADEIRO.")
        P(f"A versão 2 do prompt (seção 4.4.6) passou a exigir a verificação do conteúdo das declarações e a "
          f"proibir afirmações sobre o contexto da fala. A Tabela 2 compara as duas versões na partição de "
          f"calibração. A versão 2 passou a detectar falas falsas (revocação de FALSO de "
          f"{pct(c2['cls']['perClass']['FALSO']['recall'], 0)}) e reduziu o número médio de afirmações por item de "
          f"{num(c1['claims_mean'], 1)} para {num(c2['claims_mean'], 1)}, pois as afirmações de contexto deixaram de "
          f"existir. A acurácia caiu de {pct(c1['cls']['accuracy'])} para {pct(c2['cls']['accuracy'])}, mas o "
          f"F1 macro ficou praticamente estável ({num(c1['cls']['macroF1'])} contra {num(c2['cls']['macroF1'])}), e "
          "a diferença de dois acertos em 15 itens está dentro da variação esperada para uma amostra desse "
          "tamanho.")
        m.table("Tabela", "Comparação das versões do prompt de extração na partição de calibração",
                ["Indicador", "Versão 1", "Versão 2"],
                [["Acurácia", pct(c1['cls']['accuracy']), pct(c2['cls']['accuracy'])],
                 ["F1 macro", num(c1['cls']['macroF1']), num(c2['cls']['macroF1'])],
                 ["Revocação de VERDADEIRO", pct(c1['cls']['perClass']['VERDADEIRO']['recall'], 0), pct(c2['cls']['perClass']['VERDADEIRO']['recall'], 0)],
                 ["Revocação de FALSO", pct(c1['cls']['perClass']['FALSO']['recall'], 0), pct(c2['cls']['perClass']['FALSO']['recall'], 0)],
                 ["Revocação de IMPRECISO", pct(c1['cls']['perClass']['IMPRECISO']['recall'], 0), pct(c2['cls']['perClass']['IMPRECISO']['recall'], 0)],
                 ["Afirmações por item (média)", num(c1['claims_mean'], 1), num(c2['claims_mean'], 1)],
                 ["Decisões que usaram evidência de agência", f"{c1['used_fc']} de {c1['decided']}", f"{c2['used_fc']} de {c2['decided']}"]],
                "Elaborado pelo autor (2026), a partir de `eval/runs`.", widths=[7.2, 3.6, 3.6])
        P(f"A versão 2 foi adotada por um critério de validade, e não de desempenho: a versão 1 acertava as "
          f"falas verdadeiras por um motivo errado, pois o contexto de qualquer fala real é verdadeiro, e era "
          f"incapaz de detectar falas falsas. A última linha da Tabela 2 reforça essa leitura: na versão 1, "
          f"{c1['used_fc']} das {c1['decided']} decisões conclusivas se apoiaram em páginas da própria agência, "
          f"geralmente a checagem do mesmo debate, contra {c2['used_fc']} na versão 2. A busca em grade aplicada à "
          f"versão 2 não encontrou limiares melhores do que os iniciais: {D['calib_ties']} combinações empataram "
          f"com a melhor, e o critério de desempate manteve COVERAGE_MIN = 0,5, TRUE_MIN = 0,5 e FALSE_MAX = −0,3. "
          "O grande número de empates indica que 15 itens trazem pouca informação para distinguir limiares; "
          "manter os valores iniciais, definidos antes do experimento, evita o sobreajuste. Prompts, modelo e "
          "limiares foram então congelados, e o conjunto de teste foi executado uma única vez.")

    # ------------------------------------------------------------------ 5.4
    m.h2("5.4 Resultados no conjunto de teste")
    if not all(TR.values()):
        P("[RESULTADOS DO TESTE PENDENTES – execução em andamento]")
        return
    rows = []
    for v in ("full", "full-no-factcheck-domains", "no-decomposition", "no-retrieval"):
        r = TR[v]; c = r["cls"]
        lo, hi = r["acc_ci"]
        rows.append([VNAME[v], pct(c["accuracy"]), f"{pct(lo, 0)}–{pct(hi, 0)}", num(c["macroF1"]),
                     num(c["perClass"]["VERDADEIRO"]["f1"], 2), num(c["perClass"]["FALSO"]["f1"], 2),
                     num(c["perClass"]["IMPRECISO"]["f1"], 2)])
    P("A Tabela 3 apresenta o desempenho das quatro variantes nos 45 itens de teste, com os limiares "
      "iniciais. Nenhum item falhou: todos foram processados sem erro nas quatro variantes.")
    m.table("Tabela", "Desempenho das variantes no conjunto de teste (n = 45)",
            ["Variante", "Acurácia", "IC 95%", "F1 macro", "F1 VERD.", "F1 FALSO", "F1 IMPR."], rows,
            "Elaborado pelo autor (2026), a partir de `eval/runs`.", widths=[3.6, 1.9, 2.2, 1.8, 1.8, 1.8, 1.8])
    m.figure(D["fig_variantes"], "Acurácia e F1 macro das variantes, com as referências de comparação",
             "Elaborado pelo autor (2026).", 14)
    P(t("resultados_gerais"))
    full = TR["full"]; nofc = TR["full-no-factcheck-domains"]
    pc_rows = []
    for v in ("full", "full-no-factcheck-domains"):
        r = TR[v]
        for k in LABELS:
            pk = r["cls"]["perClass"][k]
            pc_rows.append([VNAME[v] if k == "VERDADEIRO" else "", k, num(pk["precision"], 2), num(pk["recall"], 2),
                            num(pk["f1"], 2), str(pk["predicted"])])
    m.table("Tabela", "Precisão, revocação e F1 por classe das variantes completas",
            ["Variante", "Classe", "Precisão", "Revocação", "F1", "Previstos"], pc_rows,
            "Elaborado pelo autor (2026), a partir de `eval/runs`.", widths=[3.4, 3.2, 2.2, 2.2, 2.0, 2.2])
    confusion_table(m, full, "Matriz de confusão da variante completa no conjunto de teste")
    confusion_table(m, nofc, "Matriz de confusão da variante sem agências no conjunto de teste")
    P(t("matrizes"))

    # ------------------------------------------------------------------ 5.5
    m.h2("5.5 Teste das hipóteses")
    tests = [("H1", "full", "no-decomposition"), ("H1 (sem agências)", "full-no-factcheck-domains", "no-decomposition"),
             ("H2", "full", "no-retrieval"), ("H2 (sem agências)", "full-no-factcheck-domains", "no-retrieval"),
             ("Vazamento", "full", "full-no-factcheck-domains")]
    rows = []
    D["mcnemar"] = {}
    for name, a, b in tests:
        mc = mcnemar_exact(TR[a]["ok"], TR[b]["ok"])
        D["mcnemar"][(a, b)] = mc
        da = TR[a]["cls"]["accuracy"] - TR[b]["cls"]["accuracy"]
        rows.append([name, f"{VNAME[a]} × {VNAME[b]}", ("+" if da >= 0 else "−") + pct(abs(da)),
                     str(mc["b"]), str(mc["c"]), num(mc["p"], 3)])
    P("A Tabela 7 apresenta o teste de McNemar para as comparações que operacionalizam as hipóteses. A "
      "coluna *b* conta os itens que a primeira variante acerta e a segunda erra; a coluna *c*, o inverso.")
    m.table("Tabela", "Teste de McNemar exato entre variantes (n = 45 pares)",
            ["Hipótese", "Comparação (A × B)", "Δ acurácia", "b", "c", "p"], rows,
            "Elaborado pelo autor (2026).", widths=[3.0, 6.4, 2.0, 1.0, 1.0, 1.6])
    P(t("hipoteses"))

    # ------------------------------------------------------------------ 5.6
    m.h2("5.6 Vazamento de gabarito")
    P(f"Na variante completa, {pct(full['fc_share'])} das evidências apresentadas ao LLM vieram de domínios de "
      f"agências de checagem, e {full['items_with_fc']} dos 45 itens tiveram ao menos uma evidência desse tipo; "
      f"{full['used_fc']} das {full['decided']} decisões conclusivas sobre afirmações citaram explicitamente uma "
      f"dessas evidências. Na variante sem agências, esses números são, por construção, "
      f"{pct(nofc['fc_share'])} e {nofc['used_fc']}.")
    P(t("vazamento"))

    # ------------------------------------------------------------------ 5.7
    m.h2("5.7 Custo e latência")
    rows = []
    for v in ("full", "full-no-factcheck-domains", "no-decomposition", "no-retrieval"):
        r = TR[v]
        g = r["calls"].get("gemini", 0); s = r["calls"].get("serper", 0); j = r["calls"].get("jina", 0)
        rows.append([VNAME[v], num(g / r["n"], 1), num(s / r["n"], 1), num(j / r["n"], 1),
                     intfmt(round(r["tokens_in"] / r["n"])), intfmt(round(r["tokens_out"] / r["n"])),
                     num(r["lat_mean"] / 1000, 1), num(r["lat_p95"] / 1000, 1)])
    P("A Tabela 8 apresenta o consumo médio por item. As chamadas e os *tokens* referem-se a respostas não "
      "servidas pelo cache; como as variantes compartilham buscas e páginas, as chamadas à Serper e ao Jina "
      "das variantes executadas depois da primeira são menores do que seriam com o cache vazio.")
    m.table("Tabela", "Consumo médio por item no conjunto de teste",
            ["Variante", "Gemini", "Serper", "Jina", "Tokens entrada", "Tokens saída", "Latência média (s)", "p95 (s)"], rows,
            "Elaborado pelo autor (2026), a partir de `eval/runs`.", widths=[3.2, 1.5, 1.5, 1.3, 2.0, 2.0, 2.2, 1.5])
    P(t("custo"))

    # ------------------------------------------------------------------ 5.8
    m.h2("5.8 Análise no nível da afirmação")
    lab = full["claim_labels"]; tot = sum(lab.values())
    rows = []
    for k in LABELS:
        cc = full["by_class_claims"][k]; tt = sum(cc.values()) or 1
        rows.append([k, str(sum(cc.values())), pct(cc["SUPORTADA"] / tt, 0), pct(cc["CONTRADITA"] / tt, 0),
                     pct(cc["INSUFICIENTE"] / tt, 0)])
    rows.append(["**Total**", str(tot), pct(lab["SUPORTADA"] / tot, 0), pct(lab["CONTRADITA"] / tot, 0),
                 pct(lab["INSUFICIENTE"] / tot, 0)])
    P(f"A variante completa extraiu {tot} afirmações dos 45 itens de teste, em média {num(full['claims_mean'], 1)} "
      f"por item (mediana {num(full['claims_median'], 0)}), com {num(full['ev_per_claim'], 1)} trechos de "
      "evidência por afirmação. A Tabela 9 mostra a distribuição dos rótulos das afirmações segundo a classe "
      "do item no gabarito.")
    m.table("Tabela", "Rótulos das afirmações por classe do item (variante completa)",
            ["Classe do item", "Afirmações", "SUPORTADA", "CONTRADITA", "INSUFICIENTE"], rows,
            "Elaborado pelo autor (2026), a partir de `eval/runs`.", widths=[3.6, 2.4, 2.8, 2.8, 3.0], bold_last_row=True)
    P(t("afirmacoes"))

    # ------------------------------------------------------------------ 5.9
    m.h2("5.9 Análise qualitativa dos erros")
    P(t("erros"))
    if D.get("erros_quadro"):
        m.table("Quadro", "Categorias de erro da variante sem agências no conjunto de teste",
                ["Categoria", "Itens", "Exemplo"], D["erros_quadro"],
                "Elaborado pelo autor (2026), a partir da análise de `errors.md`.", widths=[4.4, 1.4, 9.4], align_center_from=1)
    P(t("erros_fim"))

    # ------------------------------------------------------------------ 5.10
    m.h2("5.10 Discussão e ameaças à validade")
    P(t("discussao"))
    P(t("ameacas"))


def cap6(m, R, D, T):
    P = m.para
    t = lambda k: T.get(k, f"[CONCLUSÃO PENDENTE: {k}]")
    m.h1("6 CONCLUSÕES")
    for k in ("conc_intro", "conc_objetivos", "conc_hipoteses", "conc_contrib", "conc_limites"):
        for para in t(k).split("\n\n"):
            P(para)
    m.h2("6.1 Trabalhos futuros")
    P("A partir das limitações identificadas, sugerem-se os seguintes trabalhos futuros:")
    m.bullets(T.get("futuros", ["[PENDENTE]"]))


def apendices(m, prompts, mapeamento):
    m.unnumbered_title("APÊNDICE A – PROMPTS UTILIZADOS", toc=True)
    m.para("Os prompts são armazenados em `packages/core/src/prompts/*.md`, com identificador e versão no "
           "cabeçalho. As variáveis entre chaves duplas são substituídas em tempo de execução. Reproduzem-se a "
           "seguir as versões usadas na avaliação final.", "Texto")
    for name, text in prompts:
        m.para(f"**{name}**", "Normal", indent=False)
        for line in text.strip("\n").split("\n"):
            m.para(line if line.strip() else " ", "Codigo", indent=False)
        m.para("", "Normal")
    m.unnumbered_title("APÊNDICE B – MAPEAMENTO DE RÓTULOS DAS AGÊNCIAS", toc=True)
    m.para("Tabela de conversão definida antes da montagem do conjunto de dados (`eval/dataset/mapeamento_rotulos.md`). "
           "Apenas os selos da Lupa foram efetivamente usados neste trabalho.", "Texto")
    m.table("Quadro", "Conversão dos rótulos das agências para as classes do VeritasAI",
            ["Agência", "Rótulo original", "Classe"], mapeamento,
            "Elaborado pelo autor (2026).", widths=[3.6, 8.0, 3.6], align_center_from=2)
