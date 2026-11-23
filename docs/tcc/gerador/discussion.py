"""Textos que dependem dos resultados (resumo, discussão do Cap. 5, conclusões)."""
import csv, re
from content_c import pct, num, intfmt, test_runs, VNAME
from results import mcnemar_exact, LABELS
from futuros import FUTUROS

REPO = "/Users/zeni/Documents/veritasai"
TEMPORAL = re.compile(r"futur|fict[ií]ci|anacr[oô]n|inexistent|ainda não ocorr|não ocorreu|temporalmente imposs|"
                      r"suposta entrevista|suposto debate|suposta sabatina", re.I)


def texts(R, D):
    TR = test_runs(R)
    if not all(TR.values()):
        return {"resumo": "[RESUMO PENDENTE]", "abstract": "[ABSTRACT PENDENTE]"}
    full, nofc, nodec, noret = (TR[k] for k in ("full", "full-no-factcheck-domains", "no-decomposition", "no-retrieval"))
    acc = lambda r: r["cls"]["accuracy"]
    mf1 = lambda r: r["cls"]["macroF1"]
    rec = lambda r, k: r["cls"]["perClass"][k]["recall"]
    conf = lambda r, e, p: r["cls"]["confusion"][e][p]
    mc = lambda a, b: mcnemar_exact(TR[a]["ok"], TR[b]["ok"])
    h1 = mc("full", "no-decomposition"); h1b = mc("full-no-factcheck-domains", "no-decomposition")
    h2 = mc("full", "no-retrieval"); h2b = mc("full-no-factcheck-domains", "no-retrieval")
    lk = mc("full", "full-no-factcheck-domains")
    year = {r["id"]: r["data_publicacao"][:4] for r in csv.DictReader(open(f"{REPO}/eval/dataset/noticias.csv"))}
    by_year = lambda r, y: (sum(r["ok"][i] for i in r["ok"] if year[i] == y), sum(1 for i in r["ok"] if year[i] == y))
    flag = [x for x in noret["recs"] if TEMPORAL.search(x["result"]["claims"][0]["rationale"])]
    flag_ok = sum(x["expected"] == x["result"]["verdict"] for x in flag)
    n2026 = sum(1 for i in noret["ok"] if year[i] == "2026")
    noret_false_pred = sum(x["result"]["verdict"] == "FALSO" for x in noret["recs"])
    rest = [x for x in noret["recs"] if x not in flag]
    rest_ok = sum(x["expected"] == x["result"]["verdict"] for x in rest)
    best_name = max(TR, key=lambda k: acc(TR[k]))
    # custo
    PIN, POUT = 0.75, 3.75  # US$ por milhão de tokens (preço promocional listado; ver Google Cloud, 2026)
    cost_item = lambda r: (r["tokens_in"] * PIN + r["tokens_out"] * POUT) / 1e6 / r["n"]
    total_tokens_in = sum(TR[k]["tokens_in"] for k in TR); total_tokens_out = sum(TR[k]["tokens_out"] for k in TR)
    total_cost = (total_tokens_in * PIN + total_tokens_out * POUT) / 1e6
    claims = full["claims_total"]
    sig = lambda m: m["p"] < 0.05
    def pfmt(m):
        return "p < 0,001" if m["p"] < 0.001 else f"p = {num(m['p'], 3)}"
    h1_dir = "superior" if acc(full) > acc(nodec) else ("inferior" if acc(full) < acc(nodec) else "igual")
    h1_conf = sig(h1) and acc(full) > acc(nodec)
    h2_conf = sig(h2) and acc(full) > acc(noret)
    K = D.get("kappa")
    import math
    def p_chance(r):
        n = r["n"]; k = round(acc(r) * n)
        return sum(math.comb(n, i) * (1 / 3) ** i * (2 / 3) ** (n - i) for i in range(k, n + 1))
    pc = {k: p_chance(TR[k]) for k in TR}
    nodec_impr = sum(conf(nodec, e, "IMPRECISO") for e in LABELS)
    pf = lambda x: "p < 0,001" if x < 0.001 else f"p = {num(x, 3)}"

    T = {}
    # ------------------------------------------------------------------ resumo
    T["resumo"] = (
        "A disseminação de desinformação é um dos principais desafios da sociedade contemporânea; no Brasil, 72% "
        "dos usuários de redes sociais relatam ter encontrado notícias que suspeitavam ser falsas, e a capacidade "
        "média de identificá-las gira em torno de 60%. Este trabalho investiga como automatizar a verificação de "
        "conteúdos noticiosos em português por meio de um pipeline que decompõe o texto em afirmações atômicas, "
        "recupera evidências na web para cada uma e as classifica com um Modelo de Linguagem de Grande Escala (LLM), "
        "agregando os rótulos em um veredito VERDADEIRO, FALSO ou IMPRECISO acompanhado das fontes. O sistema "
        "desenvolvido, VeritasAI, foi implementado em TypeScript com o modelo Gemini, a busca Serper e o leitor Jina, "
        "com seleção de trechos por BM25, prompts versionados e cache para reprodutibilidade, além de uma API com "
        "progresso em tempo real e uma interface web. A pesquisa é aplicada, quali-quantitativa, exploratória e "
        "experimental: um estudo de ablação comparou o pipeline completo a variantes sem decomposição e sem "
        "recuperação sobre 45 declarações públicas checadas pela agência Lupa (2024–2026), após calibração em 15 "
        f"itens separados. O pipeline completo obteve acurácia de {pct(acc(full))} e F1 macro de {num(mf1(full))}, "
        f"no nível do acaso; as variantes sem decomposição ({pct(acc(nodec))}) e sem recuperação ({pct(acc(noret))}) "
        "o superaram, mas nenhuma diferença entre variantes foi estatisticamente significativa (teste de McNemar), "
        "e a hipótese de que a decomposição melhora o veredito não foi confirmada. A análise dos erros mostrou que o "
        "pipeline raramente inverte a verdade e que seus erros se concentram na classe intermediária, pela falta "
        "de evidência conclusiva para muitas afirmações e pela dificuldade de distinguir exagero de falsidade; que a variante sem decomposição acerta "
        "sobretudo por responder IMPRECISO na maioria dos casos; e que o LLM sem recuperação classificou como falsas, "
        "por considerá-las \u201cfuturas\u201d, declarações posteriores ao seu corte de conhecimento. No nível da "
        "afirmação, a concordância entre o verificador e a rotulação manual cega do autor foi moderada (Kappa de "
        f"Cohen de {num(K['kappa'], 2) if K else '–'}). O trabalho "
        "contribui com um sistema reprodutível e transparente, um protocolo de avaliação com controle de vazamento "
        "de gabarito e evidências sobre os limites dessa abordagem em português.")
    T["abstract"] = (
        "Disinformation is one of the main challenges of contemporary society; in Brazil, 72% of social media users "
        "report having encountered news they suspected to be false, and people correctly judge news veracity in "
        "about 60% of cases. This work investigates how to automate the verification of news content in Portuguese "
        "through a pipeline that decomposes the text into atomic claims, retrieves web evidence for each one, and "
        "classifies them with a Large Language Model (LLM), aggregating the labels into a TRUE, FALSE or INACCURATE "
        "verdict accompanied by its sources. The system, VeritasAI, was implemented in TypeScript with the Gemini "
        "model, the Serper search API and the Jina reader, with BM25 passage selection, versioned prompts and caching "
        "for reproducibility, plus an API with real-time progress and a web interface. The research is applied, "
        "quantitative-qualitative, exploratory and experimental: an ablation study compared the full pipeline with "
        "variants without decomposition and without retrieval on 45 public statements fact-checked by the Lupa "
        "agency (2024–2026), after calibration on 15 held-out items. The full pipeline reached "
        f"{acc(full) * 100:.1f}% accuracy and {mf1(full):.3f} macro-F1, at chance level; the variants without "
        f"decomposition ({acc(nodec) * 100:.1f}%) and without retrieval ({acc(noret) * 100:.1f}%) scored higher, but no "
        "difference between variants was statistically significant (McNemar's test), and the hypothesis that "
        "decomposition improves the verdict was not confirmed. Error analysis showed that the pipeline rarely "
        "inverts the truth and that its errors concentrate on the intermediate class, due to the lack of conclusive "
        "evidence for many claims and the difficulty of telling exaggeration from falsehood; that the variant without decomposition succeeds "
        "mostly by answering INACCURATE in most cases; and that the LLM without retrieval labeled statements made "
        "after its knowledge cutoff as false for being \u201cin the future\u201d. At the claim level, agreement between "
        f"the verifier and the author's blind manual labeling was moderate (Cohen's kappa of {(K or {}).get('kappa', 0):.2f}). The work contributes a reproducible "
        "and transparent system, an evaluation protocol that controls for answer leakage, and evidence on the limits "
        "of this approach in Portuguese.")

    # ------------------------------------------------------------------ 5.4
    T["resultados_gerais"] = (
        f"O pipeline completo obteve acurácia de {pct(acc(full))} (IC 95%: {pct(full['acc_ci'][0], 0)} a "
        f"{pct(full['acc_ci'][1], 0)}) e F1 macro de {num(mf1(full))}; com a exclusão das agências, "
        f"{pct(acc(nofc))} e {num(mf1(nofc))}. A variante sem decomposição obteve {pct(acc(nodec))} e "
        f"{num(mf1(nodec))}, e a variante sem recuperação, {pct(acc(noret))} e {num(mf1(noret))}. Nenhuma variante "
        "alcançou as referências de 60% (pessoas) e 70% (Ghadiri *et al.*, 2022). As duas variantes completas "
        f"ficaram no nível do acerto ao acaso (33,3%; teste binomial unilateral, {pf(pc['full'])}), enquanto as "
        f"variantes sem decomposição ({pf(pc['no-decomposition'])}) e sem recuperação ({pf(pc['no-retrieval'])}) o "
        "superaram. Os intervalos de confiança, com cerca de 28 pontos "
        "percentuais de largura, se sobrepõem em todas as comparações: com 45 itens, diferenças de até cerca de 15 "
        "pontos são compatíveis com variação amostral. Esse resultado, abaixo da expectativa formulada no TCC I "
        "(acurácia igual ou superior a 70%), é discutido em detalhe a seguir; antes, é preciso entender onde e por "
        "que o sistema erra.")
    T["matrizes"] = (
        f"As matrizes de confusão revelam um padrão que a acurácia esconde. Na variante completa, apenas "
        f"{full['inversions']} dos 45 itens tiveram a verdade invertida ({conf(full, 'FALSO', 'VERDADEIRO')} falsos "
        f"classificados como VERDADEIRO e {conf(full, 'VERDADEIRO', 'FALSO')} verdadeiro classificado como FALSO); os "
        f"demais {full['adjacent']} erros envolvem a classe intermediária. Dois fluxos concentram esses erros. O "
        f"primeiro é VERDADEIRO → IMPRECISO ({conf(full, 'VERDADEIRO', 'IMPRECISO')} de 15): o sistema é conservador e, "
        f"quando não encontra evidência conclusiva para a maioria das afirmações, recusa-se a confirmar; "
        f"{full['low_cov']} itens tiveram cobertura inferior a 50%. O segundo é IMPRECISO → FALSO "
        f"({conf(full, 'IMPRECISO', 'FALSO')} de 15): as falas rotuladas como Exagerado ou Subestimado contêm um número "
        "distorcido, e a verificação, ao encontrar o valor correto, classifica a afirmação como CONTRADITA, sem "
        "dispor de um rótulo para “exagerado”; com uma única afirmação central contradita, o score vai a −1 "
        "e o veredito, a FALSO. A precisão de VERDADEIRO foi a mais alta entre as classes "
        f"({pct(full['cls']['perClass']['VERDADEIRO']['precision'], 0)}): quando o sistema confirma, costuma acertar, "
        "mas confirma pouco.")
    # ------------------------------------------------------------------ 5.5
    T["hipoteses"] = (
        f"**H1 (decomposição).** A diferença de acurácia entre o pipeline completo e a variante sem decomposição foi "
        f"de {pct(abs(acc(full) - acc(nodec)))} ({'a favor do completo' if acc(full) > acc(nodec) else 'a favor da variante sem decomposição' if acc(full) < acc(nodec) else 'empate'}), "
        f"com {h1['b']} itens acertados só pelo completo e {h1['c']} só pela variante sem decomposição ({pfmt(h1)}). "
        + ("A hipótese H1 é, portanto, confirmada neste conjunto. " if h1_conf else
           "A hipótese H1 não foi confirmada: não há evidência estatística de que a decomposição melhore o veredito "
           "neste conjunto; a diferença observada, aliás, foi no sentido oposto ao previsto. ") +
        f"A vantagem da variante sem decomposição tem, porém, uma origem clara: ela respondeu IMPRECISO em "
        f"{nodec_impr} dos 45 itens ({pct(nodec_impr / 45, 0)}), acertando {conf(nodec, 'IMPRECISO', 'IMPRECISO')} dos 15 "
        f"itens IMPRECISOS, mas apenas {conf(nodec, 'VERDADEIRO', 'VERDADEIRO')} dos 15 VERDADEIROS e "
        f"{conf(nodec, 'FALSO', 'FALSO')} dos 15 FALSOS. Diante do texto inteiro e de evidências parciais, o LLM "
        "tende a escolher a classe intermediária, que no gabarito balanceado corresponde a um terço dos itens; o "
        "pipeline completo, ao contrário, compromete-se com CONTRADITA quando encontra um número divergente e, por "
        "isso, erra mais na direção de FALSO. "
        "Esse resultado precisa ser lido à luz do formato dos dados, registrado antes do experimento (seção 5.2.1): "
        f"as falas têm em média {num(full['claims_mean'], 1)} afirmações, e um texto com duas afirmações oferece pouco "
        "espaço para que a decomposição revele uma informação falsa escondida entre verdadeiras, que é justamente o "
        "cenário que a motivou. Além disso, a decomposição introduz um custo: cada afirmação adicional é uma nova "
        "oportunidade de INSUFICIENTE ou de CONTRADITA por um detalhe periférico, e a agregação, que dá o mesmo peso "
        "a todas as afirmações, transforma esses detalhes em IMPRECISO ou FALSO.\n\n"
        f"**H2 (recuperação).** A variante sem recuperação obteve acurácia {'maior' if acc(noret) > acc(full) else 'menor'} "
        f"do que o pipeline completo ({pct(acc(noret))} contra {pct(acc(full))}; b = {h2['b']}, c = {h2['c']}, "
        f"{pfmt(h2)}), " + ("diferença estatisticamente significativa. " if sig(h2) else "diferença não significativa. ") +
        "A análise das justificativas mostra, porém, que esse desempenho não decorre de conhecimento confiável. Em "
        f"{len(flag)} dos {n2026} itens de 2026, o modelo afirmou que a declaração era “futura”, "
        "“fictícia” ou “anacrônica”, pois se referia a eventos posteriores ao seu corte de "
        f"conhecimento, e classificou {sum(x['result']['verdict'] == 'FALSO' for x in flag)} deles como FALSO; apenas "
        f"{flag_ok} desses {len(flag)} coincidiram com o gabarito. No total, a variante previu FALSO em "
        f"{noret_false_pred} dos 45 itens ({pct(noret_false_pred / 45, 0)}), o que explica a sua alta revocação de FALSO "
        f"({pct(rec(noret, 'FALSO'), 0)}) e também o seu maior número de inversões graves ({noret['inversions']}, "
        f"contra {full['inversions']} do pipeline completo). Desconsiderados os itens em que o modelo alegou "
        f"impossibilidade temporal, sua acurácia foi de {pct(rest_ok / len(rest))} ({rest_ok} de {len(rest)}). Assim, "
        "embora H2 não tenha sido confirmada em termos de acurácia, o experimento ilustra concretamente o risco que "
        "motivou o uso de RAG: sem evidências, o LLM produz vereditos confiantes e fundamentados em uma premissa "
        "falsa, a de que o presente é o seu corte de treinamento.")
    # ------------------------------------------------------------------ 5.6
    T["vazamento"] = (
        f"A exclusão das agências reduziu a acurácia de {pct(acc(full))} para {pct(acc(nofc))} (b = {lk['b']}, "
        f"c = {lk['c']}, {pfmt(lk)}), uma diferença pequena e não significativa. Isso indica que, com a versão 2 do "
        "prompt, o vazamento de gabarito teve efeito marginal sobre as métricas: como as afirmações passaram a "
        "descrever o conteúdo, e não o contexto da fala, as consultas deixaram de levar às páginas de cobertura "
        "do debate publicadas pelas agências. Na versão 1, ao contrário, 9 das 32 decisões conclusivas da "
        "calibração se apoiaram em páginas da própria Lupa (Tabela 2). O controle de vazamento se mostrou, "
        "portanto, necessário para validar o experimento, ainda que, na configuração final, o seu efeito tenha sido "
        "pequeno. Em uso real, encontrar uma checagem já publicada é desejável, e a variante completa é a que "
        "corresponde ao sistema entregue ao usuário.")
    # ------------------------------------------------------------------ 5.7
    T["custo"] = (
        f"O pipeline completo fez, em média, {num(full['calls'].get('gemini', 0) / full['n'], 1)} chamadas ao Gemini e "
        f"consumiu {intfmt(round(full['tokens_in'] / full['n']))} *tokens* de entrada e {intfmt(round(full['tokens_out'] / full['n']))} "
        f"de saída por item, com latência média de {num(full['lat_mean'] / 1000, 1)} s (p95 de "
        f"{num(full['lat_p95'] / 1000, 1)} s). A etapa de evidências, que lê as páginas, é a mais demorada, seguida da "
        "verificação. Os *tokens* de saída superam os de entrada na variante sem recuperação porque incluem o "
        "raciocínio interno do modelo (seção 2.6). Com o preço promocional listado para o modelo Flash, US$ 0,75 por "
        "milhão de *tokens* de entrada e US$ 3,75 por milhão de saída (Google Cloud, 2026), o custo estimado do LLM é "
        f"de US$ {num(cost_item(full), 4)} por item no pipeline completo, cerca de R$ {num(cost_item(full) * 5.4, 2)} "
        f"ao câmbio de R$ 5,40. As quatro variantes, no conjunto de teste e excluídas as respostas servidas pelo "
        f"cache, consumiram cerca de {round(total_tokens_in / 1000)} mil *tokens* de entrada e "
        f"{round(total_tokens_out / 1000)} mil de saída, aproximadamente US$ {num(total_cost, 2)}. O "
        "valor efetivamente cobrado pelo Google para todas as execuções do experimento, incluindo as duas "
        "calibrações, as quatro variantes do teste e as execuções interrompidas, 227 itens no total, foi de "
        "R$ 9,35, média de cerca de R$ 0,04 por item, ordem de grandeza compatível com a estimativa. O custo por "
        "verificação é, portanto, baixo; o limite prático do plano gratuito está no número de requisições por dia, "
        "e não no preço.")
    # ------------------------------------------------------------------ 5.8
    lab = full["claim_labels"]
    def share(cls_, lab_):
        c_ = full["by_class_claims"][cls_]; tot_ = sum(c_.values()) or 1
        return pct(c_[lab_] / tot_, 0)
    kappa_txt = ""
    if K:
        kappa_txt = (
            f" Para avaliar a etapa de verificação isoladamente, o autor rotulou manualmente, sem ver o rótulo do "
            f"sistema, as {K['n']} afirmações do conjunto de teste, usando as mesmas evidências que o sistema recebeu. "
            f"A concordância foi de {pct(K['accuracy'])}, com Kappa de Cohen de {num(K['kappa'], 2)}, considerada "
            f"{K['interp']} segundo Landis e Koch (1977).")
        cf = K.get("confusion")
        if cf:
            L3 = ["SUPORTADA", "CONTRADITA", "INSUFICIENTE"]
            hum_i = sum(cf["INSUFICIENTE"].values()); sys_i = sum(cf[h]["INSUFICIENTE"] for h in L3)
            dis = sum(cf[h][s_] for h in L3 for s_ in L3 if h != s_)
            over_c = cf["SUPORTADA"]["CONTRADITA"] + cf["INSUFICIENTE"]["CONTRADITA"]
            sys_c = sum(cf[h]["CONTRADITA"] for h in L3); hum_c = sum(cf["CONTRADITA"].values())
            kappa_txt += (
                f" A matriz de concordância corrige uma leitura possível dos resultados anteriores. Com as mesmas "
                f"evidências, o próprio autor julgou INSUFICIENTES {hum_i} das {K['n']} afirmações "
                f"({pct(hum_i / K['n'], 0)}), proporção próxima à do sistema ({sys_i}, {pct(sys_i / K['n'], 0)}): a "
                "baixa cobertura decorre sobretudo das evidências recuperadas, que muitas vezes não tratam do ponto "
                "exato da afirmação, e não de uma recusa indevida do classificador. O desvio mais frequente vai no "
                f"sentido oposto: das {dis} discordâncias, {over_c} são afirmações que o sistema classificou como "
                f"CONTRADITA e o autor como SUPORTADA ({cf['SUPORTADA']['CONTRADITA']}) ou INSUFICIENTE "
                f"({cf['INSUFICIENTE']['CONTRADITA']}), em geral porque as evidências tratavam de outro período, "
                "recorte ou aspecto do assunto e o sistema tomou a diferença como contradição, quando ela apenas não "
                "permitia decidir. Nenhuma afirmação julgada CONTRADITA pelo autor foi classificada como SUPORTADA. "
                f"Assim, a revocação de CONTRADITA foi alta ({cf['CONTRADITA']['CONTRADITA']} de {hum_c}) e a sua "
                f"precisão, menor ({cf['CONTRADITA']['CONTRADITA']} de {sys_c}): o verificador detecta quase todas as "
                "contradições ao custo de falsos alarmes, o que reforça o fluxo IMPRECISO → FALSO descrito na seção 5.4.")
    else:
        kappa_txt = (
            " A rotulação manual das afirmações para o cálculo do Kappa de Cohen, prevista no TCC I, não pôde ser "
            "concluída no prazo deste trabalho e é indicada como trabalho futuro; os artefatos para realizá-la, a "
            "amostra cega e o script de cálculo, estão disponíveis no repositório.")
    T["afirmacoes"] = (
        f"No nível da afirmação, {pct(lab['INSUFICIENTE'] / claims, 0)} das afirmações foram classificadas como "
        "INSUFICIENTE, o principal fator da baixa cobertura. A distribuição por classe vai na direção esperada: a "
        f"proporção de afirmações CONTRADITAS é maior nos itens FALSO ({share('FALSO', 'CONTRADITA')}) e IMPRECISO "
        f"({share('IMPRECISO', 'CONTRADITA')}) do que nos VERDADEIRO ({share('VERDADEIRO', 'CONTRADITA')}), e a de "
        f"SUPORTADAS é maior nos VERDADEIRO ({share('VERDADEIRO', 'SUPORTADA')}) do que nos FALSO "
        f"({share('FALSO', 'SUPORTADA')}) e IMPRECISO ({share('IMPRECISO', 'SUPORTADA')}). Isso indica que o sinal está presente no nível da afirmação e se perde, em parte, na "
        "agregação: a regra trata da mesma forma uma afirmação central e um detalhe lateral, e a classe IMPRECISO "
        "não tem correspondente no nível da afirmação." + kappa_txt)
    # ------------------------------------------------------------------ 5.9
    T["erros"] = (
        "A análise qualitativa examinou todos os itens em que a variante sem agências errou, com o auxílio do "
        "arquivo `errors.md` gerado pela avaliação, que lista, para cada erro, as afirmações, os rótulos, as "
        "justificativas e as evidências. Os erros foram agrupados em categorias, apresentadas no Quadro 11; um "
        "mesmo item pode ter mais de uma causa, e foi atribuída a predominante.")
    T["erros_fim"] = (
        "Três observações se destacam. Primeiro, a regra de prudência do prompt de verificação, que manda preferir "
        "INSUFICIENTE a SUPORTADA quando um número ou data não aparece nas evidências, cumpre o seu papel de evitar "
        "confirmações indevidas, mas penaliza falas verdadeiras com números arredondados (“cerca de 7,3 "
        "milhões”). Segundo, a decomposição às vezes cria afirmações periféricas, como a duração de uma "
        "investigação citada de passagem, que, contraditas, contaminam o veredito de uma fala cujo núcleo era "
        "verdadeiro. Terceiro, a fronteira entre IMPRECISO e FALSO é uma questão de grau: a Lupa rotula como "
        "Exagerado um número inflado na direção correta, enquanto o sistema só sabe dizer que o número não "
        "confere. Somados à análise de concordância da seção 5.8, esses mecanismos indicam dois problemas distintos: "
        "a baixa cobertura vem principalmente das evidências recuperadas, e os erros nas afirmações decididas vêm "
        "da semântica dos rótulos e da agregação. Ambos orientam os trabalhos futuros.")
    # ------------------------------------------------------------------ 5.10
    T["discussao"] = (
        "Frente às referências, o desempenho obtido está abaixo do acerto médio de pessoas (60%) e de Ghadiri *et "
        "al.* (2022), 70%, que, no entanto, tratava de uma tarefa binária, sobre *tweets* em inglês, com outra "
        "definição de classes; comparações diretas não são possíveis. A comparação mais informativa é interna: o "
        "sistema, em todas as variantes com recuperação, raramente inverte a verdade, e o seu recorte binário "
        "(VERDADEIRO contra não VERDADEIRO), uma análise exploratória feita depois do experimento e não planejada, "
        f"acerta {pct(full['bin_acc'])} dos itens na variante completa, patamar semelhante ao das variantes sem "
        f"decomposição ({pct(nodec['bin_acc'])}) e sem recuperação ({pct(noret['bin_acc'])}). O sistema é, portanto, mais útil como "
        "sinalizador de que um conteúdo merece desconfiança do que como juiz de três classes, e a transparência das "
        "evidências, que o usuário pode inspecionar, é o que permite usar o veredito com esse cuidado.\n\n"
        "O resultado negativo para H1 não invalida a ideia de decomposição, mas delimita as condições em que ela "
        "ajuda. Em textos curtos e centrados em uma única alegação, como as falas checadas, verificar o texto "
        "inteiro é tão bom quanto decompô-lo e mais barato; o benefício esperado depende de textos longos, com "
        "várias afirmações independentes, cenário que o conjunto de dados não pôde cobrir pela escassez de "
        "checagens de notícias extraíveis (seção 5.2.1). O experimento mostrou também que a decomposição só "
        "produz o efeito desejado se a agregação souber distinguir o essencial do periférico.")
    T["ameacas"] = (
        "Quanto às ameaças à validade: (i) o conjunto é pequeno, 45 itens de teste, o que gera intervalos de "
        "confiança largos e baixo poder estatístico para detectar diferenças moderadas; (ii) os itens são de uma "
        "única agência e de um único formato, declarações de políticos, com predomínio do tema política, o que "
        "limita a generalização para notícias em geral; (iii) o gabarito depende do julgamento da agência e do "
        "mapeamento de selos, e a fronteira entre Exagerado e Falso é em parte subjetiva; (iv) o LLM não é "
        "determinístico, mesmo com temperatura zero e semente fixa, e cada variante foi executada uma única vez, "
        "embora o cache permita reproduzir exatamente as respostas obtidas; (v) a versão 2 do prompt foi definida "
        "após observar a partição de calibração, procedimento legítimo, pois essa partição existe para ajustes, "
        "mas que torna os resultados de calibração otimistas; e (vi) a web muda com o tempo, de modo que uma nova "
        "execução sem o cache pode encontrar evidências diferentes.")

    # ------------------------------------------------------------------ Cap. 6
    T["conc_intro"] = (
        "Este trabalho investigou como automatizar a verificação de conteúdos noticiosos em português por meio de "
        "um pipeline que decompõe o texto em afirmações atômicas, recupera evidências na web e as classifica com um "
        "LLM. Para responder a essa questão, foi desenvolvido o VeritasAI, um sistema completo, com núcleo de "
        "verificação, API com progresso em tempo real, interface web e um ambiente de avaliação reprodutível, e foi "
        "conduzido um experimento de ablação sobre declarações checadas pela agência Lupa.\n\n"
        "A resposta obtida tem duas partes. A primeira é afirmativa: é possível automatizar todas as etapas, da "
        "entrada do conteúdo ao veredito, com custo baixo, de poucos centavos de real por verificação, e com "
        "rastreabilidade completa, pois cada rótulo aponta as evidências que o sustentam. A segunda é uma "
        "qualificação: no conjunto avaliado, o veredito em três classes produzido pelo pipeline completo ficou no "
        "nível do acaso, e as variantes mais simples, sem decomposição e sem recuperação, obtiveram acurácias "
        "maiores, embora sem diferença estatisticamente significativa. O sistema raramente inverte a verdade, mas tem "
        "dificuldade com a classe intermediária, porque muitas afirmações ficam sem evidência conclusiva e porque a sua semântica de rótulos não "
        "captura a ideia de exagero.")
    T["conc_objetivos"] = (
        "Quanto aos objetivos específicos (Quadro 2): (a) a fundamentação teórica foi apresentada no Capítulo 2, "
        "aprofundando a proposta do TCC I com o modelo BM25, a descontextualização de afirmações e as métricas de "
        "avaliação; (b) seis trabalhos relacionados foram analisados e comparados no Capítulo 3, evidenciando a "
        "lacuna de sistemas de ponta a ponta em português com busca aberta; (c) o pipeline foi especificado e "
        f"implementado, com requisitos, casos de uso, arquitetura, modelo de dados e {D['tests']} testes "
        "automatizados (Capítulo 4); (d) o conjunto de avaliação foi construído, com 60 itens balanceados e "
        "partições de calibração e de teste (seção 5.2.1); e (e) o experimento foi executado e as hipóteses foram "
        "testadas (seções 5.3 a 5.9). Todos os objetivos específicos foram, portanto, atendidos. O objetivo geral, "
        "contribuir para a redução da propagação de desinformação por meio do desenvolvimento e da avaliação "
        "experimental do sistema, foi atendido na medida do que um trabalho de pesquisa pode demonstrar: o sistema "
        "existe, funciona e foi avaliado com rigor, e a avaliação mostra com clareza em que condições ele já ajuda, "
        "como sinalizador transparente e de baixo custo, e o que falta para que o seu veredito em três classes seja "
        "confiável.")
    T["conc_hipoteses"] = (
        ("A hipótese principal (H1), de que a decomposição em afirmações atômicas produz vereditos mais precisos do "
         "que a verificação do texto como bloco único, não foi confirmada neste conjunto de dados; a diferença "
         "observada foi no sentido oposto, sem significância estatística, e decorre em boa parte da tendência da "
         "variante sem decomposição de responder IMPRECISO. " if not h1_conf else
         "A hipótese principal (H1) foi confirmada neste conjunto de dados. ") +
        "O resultado é coerente com a limitação anunciada antes do experimento: as declarações checadas são curtas "
        "e centradas em uma única alegação. A hipótese secundária (H2) também não foi confirmada em termos de "
        "acurácia, mas o experimento revelou o mecanismo de erro que motiva a recuperação de evidências: sem elas, "
        "o LLM declarou falsas, por “futuras”, declarações reais posteriores ao seu treinamento. O valor "
        "da recuperação, neste trabalho, aparece menos na acurácia e mais na validade e na transparência dos "
        "vereditos.")
    T["conc_contrib"] = (
        "Como contribuições para a Engenharia de Software e para a área, destacam-se: (i) um sistema de "
        "verificação de ponta a ponta em português, com código aberto à inspeção, serviços externos isolados por "
        "interfaces e degradação elegante em caso de falha; (ii) um protocolo de avaliação reprodutível, com "
        "prompts versionados, cache de todas as respostas externas, separação entre calibração e teste, controle "
        "de vazamento de gabarito e ablação; (iii) evidências empíricas sobre os limites da abordagem, em especial a "
        "fronteira entre exagero e falsidade e o efeito do corte de conhecimento sobre o LLM sem recuperação; e (iv) "
        "o relato das decisões e dos problemas encontrados no desenvolvimento, como a interferência de uma "
        "dependência no `fetch` global, a revisão do prompt de extração e a constatação de que as checagens "
        "recentes tratam majoritariamente de conteúdos de redes sociais.")
    T["conc_limites"] = (
        "Entre as limitações, além das ameaças à validade discutidas na seção 5.10, estão: o sistema opera apenas "
        "sobre texto, enquanto a maior parte da desinformação recente circula em vídeo e imagem; depende de "
        "serviços comerciais cujos limites e preços mudam sem aviso; e foi avaliado em um único domínio, o de "
        "declarações políticas. Nenhuma dessas limitações impede o uso do sistema como ferramenta de apoio, desde "
        "que acompanhado do aviso permanente e da exibição das fontes, como foi projetado.")
    T["futuros"] = FUTUROS
    return T
