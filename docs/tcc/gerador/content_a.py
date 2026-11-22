"""Elementos pré-textuais e capítulos 1 a 3."""
from docx.enum.text import WD_ALIGN_PARAGRAPH as A
from docx.shared import Cm, Pt

TITULO = ("VeritasAI: um pipeline de verificação automatizada de fatos para conteúdos "
          "noticiosos em português baseado em afirmações atômicas e recuperação de evidências")
AUTOR = "Augusto Zeni"
DATA = "Lajeado, novembro de 2026"


def capa(m):
    m.para("UNIVERSIDADE DO VALE DO TAQUARI – UNIVATES", "Normal", A.CENTER, bold=True)
    m.para("CURSO DE ENGENHARIA DE SOFTWARE", "Normal", A.CENTER, bold=True)
    for _ in range(9):
        m.para("", "Normal")
    m.para(TITULO, "Normal", A.CENTER, bold=True)
    for _ in range(2):
        m.para("", "Normal")
    m.para(AUTOR, "Normal", A.CENTER)
    for _ in range(11):
        m.para("", "Normal")
    m.para(DATA, "Normal", A.CENTER)


def folha_rosto(m):
    m.para(AUTOR, "Normal", A.CENTER)
    for _ in range(8):
        m.para("", "Normal")
    m.para(TITULO, "Normal", A.CENTER, bold=True)
    for _ in range(3):
        m.para("", "Normal")
    p = m.para("Monografia apresentada na disciplina de Trabalho de Conclusão de Curso II, do curso de "
               "Engenharia de Software, da Universidade do Vale do Taquari – Univates, como parte da "
               "exigência para a obtenção do título de Bacharel em Engenharia de Software.", "Normal", A.JUSTIFY)
    p.paragraph_format.left_indent = Cm(8); p.paragraph_format.line_spacing = 1.0
    m.para("", "Normal")
    p = m.para("Orientador: Prof. Me. Edson Moacir Ahlert", "Normal", A.LEFT)
    p.paragraph_format.left_indent = Cm(8)
    for _ in range(10):
        m.para("", "Normal")
    m.para(DATA, "Normal", A.CENTER)
    m.page_break()


def banca(m):
    m.para(AUTOR, "Normal", A.CENTER)
    m.para("", "Normal")
    m.para(TITULO, "Normal", A.CENTER, bold=True)
    m.para("", "Normal")
    p = m.para("A Banca examinadora abaixo aprova a Monografia apresentada na disciplina de Trabalho de "
               "Conclusão de Curso II, do curso de Engenharia de Software, da Universidade do Vale do "
               "Taquari – Univates, como parte da exigência para a obtenção do grau de Bacharel em "
               "Engenharia de Software.", "Normal", A.JUSTIFY)
    p.paragraph_format.left_indent = Cm(8); p.paragraph_format.line_spacing = 1.0
    m.para("", "Normal")
    for nome, papel in (("Prof. Me. Edson Moacir Ahlert – orientador", "Universidade do Vale do Taquari – Univates"),
                        ("Prof. Evandro Franzen", "Universidade do Vale do Taquari – Univates"),
                        ("Prof. Mouriac Diemer", "Universidade do Vale do Taquari – Univates")):
        m.para("", "Normal"); m.para("", "Normal")
        m.para("_______________________________________________", "Normal", A.CENTER)
        m.para(nome, "Normal", A.CENTER)
        m.para(papel, "Normal", A.CENTER)
    m.para("", "Normal")
    m.para("Lajeado, ____ de ____________ de 2026", "Normal", A.CENTER)


def resumo(m, R):
    m.unnumbered_title("RESUMO")
    p = m.para(R["resumo"], "Normal", A.JUSTIFY, indent=False)
    p.paragraph_format.line_spacing = 1.0
    m.para("", "Normal")
    p = m.para("**Palavras-chave:** verificação automatizada de fatos; desinformação; modelos de linguagem "
               "de grande escala; afirmações atômicas; geração aumentada por recuperação.", "Normal", A.JUSTIFY)
    p.paragraph_format.line_spacing = 1.0
    m.unnumbered_title("ABSTRACT").paragraph_format.page_break_before = True
    p = m.para(R["abstract"], "Normal", A.JUSTIFY)
    p.paragraph_format.line_spacing = 1.0
    m.para("", "Normal")
    p = m.para("**Keywords:** automated fact-checking; disinformation; large language models; atomic "
               "claims; retrieval-augmented generation.", "Normal", A.JUSTIFY)
    p.paragraph_format.line_spacing = 1.0


SIGLAS = [
    ("AFC", "Automated Fact-Checking – Verificação Automatizada de Fatos"),
    ("API", "Application Programming Interface – Interface de Programação de Aplicações"),
    ("BM25", "Best Matching 25 – função de ranqueamento probabilístico"),
    ("HTTP", "Hypertext Transfer Protocol – Protocolo de Transferência de Hipertexto"),
    ("IDF", "Inverse Document Frequency – Frequência Inversa de Documento"),
    ("IFCN", "International Fact-Checking Network"),
    ("JSON", "JavaScript Object Notation – Notação de Objetos JavaScript"),
    ("LLM", "Large Language Model – Modelo de Linguagem de Grande Escala"),
    ("NEI", "Not Enough Info – informação insuficiente"),
    ("NLI", "Natural Language Inference – Inferência de Linguagem Natural"),
    ("NLP", "Natural Language Processing – Processamento de Linguagem Natural"),
    ("OCDE", "Organização para a Cooperação e Desenvolvimento Econômico"),
    ("RAG", "Retrieval-Augmented Generation – Geração Aumentada por Recuperação"),
    ("RF", "Requisito Funcional"),
    ("RNF", "Requisito Não Funcional"),
    ("RPD", "Requisições por dia"),
    ("RPM", "Requisições por minuto"),
    ("SSE", "Server-Sent Events – eventos enviados pelo servidor"),
    ("SSRF", "Server-Side Request Forgery – falsificação de requisição do lado do servidor"),
    ("TF", "Term Frequency – Frequência do Termo"),
    ("UC", "Caso de Uso"),
    ("URL", "Uniform Resource Locator – Localizador Uniforme de Recursos"),
]


def listas(m, meta):
    m.unnumbered_title("LISTA DE FIGURAS").paragraph_format.page_break_before = True
    m.caption_list("Figura", meta.get("Figura", []))
    m.unnumbered_title("LISTA DE QUADROS").paragraph_format.page_break_before = True
    m.caption_list("Quadro", meta.get("Quadro", []))
    m.unnumbered_title("LISTA DE TABELAS").paragraph_format.page_break_before = True
    m.caption_list("Tabela", meta.get("Tabela", []))
    m.unnumbered_title("LISTA DE ABREVIATURAS E SIGLAS").paragraph_format.page_break_before = True
    for s, d in SIGLAS:
        p = m.para(f"{s}\t{d}", "Normal", A.LEFT)
        p.paragraph_format.tab_stops.add_tab_stop(Cm(2.5))
        p.paragraph_format.left_indent = Cm(2.5); p.paragraph_format.first_line_indent = Cm(-2.5)
    m.unnumbered_title("SUMÁRIO").paragraph_format.page_break_before = True
    m.toc(meta.get("headings", []))


# =============================================================================== CAPÍTULO 1
def cap1(m, R):
    m.h1("1 INTRODUÇÃO", new_page=False)
    P = m.para
    P("A velocidade com que a informação circula na era digital trouxe consigo um fenômeno de proporções "
      "alarmantes: a disseminação massiva de conteúdos falsos ou distorcidos, popularmente conhecidos como "
      "*fake news*. O termo, embora recente em seu uso corrente, descreve uma prática antiga de manipulação "
      "informacional que ganhou escala inédita com as redes sociais, os aplicativos de mensagens instantâneas "
      "e os algoritmos de recomendação de conteúdo (Wardle; Derakhshan, 2017).")
    P("No Brasil, esse cenário apresenta contornos particularmente preocupantes. Segundo pesquisa do "
      "Instituto DataSenado realizada em 2024 com 21.808 brasileiros, 93% da população utiliza alguma rede "
      "social, incluindo aplicativos de mensagens como WhatsApp e Telegram, e 72% relataram ter acessado "
      "notícias que desconfiavam ser falsas nos seis meses anteriores (DataSenado, 2024). O Digital News "
      "Report 2025, elaborado pelo Reuters Institute a partir de entrevistas com mais de 90 mil pessoas em "
      "48 países, indica que 63% dos brasileiros consomem notícias por redes sociais ao menos uma vez por "
      "semana e que 58% da população mundial afirma ter dificuldade em distinguir o verdadeiro do falso no "
      "ambiente digital (Newman *et al.*, 2025).")
    P("O problema se aprofunda quando se observa a capacidade individual de discernimento. Um relatório da "
      "Organização para a Cooperação e Desenvolvimento Econômico (OCDE), publicado em 2024 e repercutido pelo "
      "Jornal da USP, indica que as pessoas identificam corretamente a veracidade de uma notícia em apenas "
      "60% dos casos; o Brasil figura entre os piores do estudo nessa tarefa, ao mesmo tempo em que apresenta "
      "a maior taxa de confiança em informações provenientes de redes sociais: mais de 20% dos brasileiros "
      "confiam muito nelas, contra uma média de 9% entre os países pesquisados (Jornal da USP, 2024). Esse "
      "paradoxo, baixa acurácia combinada com alta confiança, torna o público especialmente vulnerável.")
    P("Além do volume, o fenômeno se torna mais sofisticado. De acordo com o primeiro Panorama da "
      "Desinformação no Brasil, publicado pelo Observatório Lupa em 2026, os conteúdos falsos criados com "
      "inteligência artificial cresceram 308% entre 2024 e 2025, e os *deep fakes* passaram de 4,6% para 25% "
      "do total de checagens realizadas pela agência (Agência Brasil, 2026).")
    P("As agências brasileiras de checagem de fatos, como Lupa, Aos Fatos e Estadão Verifica, realizam um "
      "trabalho jornalístico criterioso, porém essencialmente manual e reativo: equipes especializadas "
      "analisam conteúdos que já viralizaram e publicam suas verificações horas ou dias depois da circulação "
      "inicial (Graves, 2016). Esse modelo não acompanha o ritmo de produção de conteúdo enganoso, de modo que "
      "a maior parte dele nunca é verificada. Surge, assim, a motivação deste trabalho: investigar se é "
      "possível oferecer ao cidadão uma triagem rápida, automatizada e transparente da veracidade de um "
      "conteúdo noticioso, sem substituir o trabalho jornalístico, mas ampliando o seu alcance.")
    P("Duas linhas de avanço recentes tornam essa investigação oportuna. A primeira são os Modelos de "
      "Linguagem de Grande Escala (*Large Language Models*, LLMs), capazes de compreender e raciocinar sobre "
      "textos em português sem treinamento específico para cada tarefa (Wei *et al.*, 2022a). A segunda é o "
      "paradigma de Geração Aumentada por Recuperação (*Retrieval-Augmented Generation*, RAG), que fornece ao "
      "modelo evidências recuperadas no momento da consulta, reduzindo a dependência de seu conhecimento "
      "interno, sujeito a desatualização e a alucinações (Lewis *et al.*, 2020; Ji *et al.*, 2023). A "
      "literatura de verificação automatizada de fatos combina esses elementos em pipelines que decompõem o "
      "texto em afirmações atômicas, recuperam evidências para cada uma e as classificam individualmente "
      "(Min *et al.*, 2023; Wei *et al.*, 2024), mas os trabalhos encontrados raramente operam em português, "
      "sobre conteúdos noticiosos completos e com busca aberta na web (Capítulo 3).")
    P("A relevância do trabalho é, portanto, dupla. Do ponto de vista social, ele se insere no esforço de "
      "conter a propagação de desinformação em um país com alta exposição e baixa capacidade de "
      "discernimento. Do ponto de vista da Engenharia de Software, contribui com a especificação, a "
      "implementação e a avaliação experimental reprodutível de um sistema que integra LLMs, busca na web e "
      "regras de agregação explícitas, com prompts versionados, cache de respostas e um protocolo de "
      "ablação que permite medir a contribuição de cada componente.")
    P("Este trabalho adota o termo **conteúdo noticioso** para designar tanto uma notícia publicada em um "
      "site quanto uma declaração pública noticiada (por exemplo, a fala de um candidato em um debate "
      "televisionado). O sistema aceita como entrada a URL de uma notícia ou o texto do conteúdo. Essa "
      "delimitação decorre de um achado do próprio desenvolvimento, discutido na seção 5.2.1: a maior parte "
      "das checagens recentes das agências trata de vídeos e publicações em redes sociais, e não de páginas "
      "de notícias extraíveis por URL.")

    m.h2("1.1 Problema de pesquisa e hipótese")
    P("Considerando o alto índice de exposição da população brasileira à desinformação, a dificuldade "
      "individual de identificar conteúdos falsos e a impossibilidade de as agências verificarem "
      "manualmente tudo o que circula, este trabalho busca responder à seguinte questão de pesquisa:")
    q = m.para("Como automatizar a verificação de conteúdos noticiosos em língua portuguesa por meio de um "
               "pipeline computacional baseado em extração de afirmações atômicas, recuperação dinâmica de "
               "evidências na web e classificação com Modelos de Linguagem de Grande Escala, de modo que o "
               "veredito produzido seja mensuravelmente correto e rastreável até as suas fontes?", "Citacao longa")
    P("A hipótese principal (H1) é a de que decompor um conteúdo em afirmações verificáveis menores e "
      "buscar evidências independentes para cada uma delas produz vereditos mais precisos do que tratar o "
      "texto como um bloco único, submetido a uma única busca e a uma única classificação. Uma hipótese "
      "secundária (H2) é a de que a recuperação de evidências na web melhora o desempenho em relação ao "
      "julgamento do LLM baseado apenas em seu conhecimento interno, especialmente para fatos recentes, "
      "posteriores ao corte de treinamento do modelo.")
    P("As duas hipóteses são operacionalizadas como comparações entre variantes do sistema (seção 5.2): H1 "
      "compara o pipeline completo com uma variante sem decomposição; H2 compara o pipeline completo com uma "
      "variante sem recuperação. Ambas são avaliadas pelo F1 macro e pela acurácia sobre um conjunto de "
      "teste com gabarito de agência de checagem, e a significância das diferenças é verificada pelo teste "
      "de McNemar (McNemar, 1947).")

    m.h2("1.2 Objetivos")
    P("O objetivo geral deste trabalho é contribuir para a redução da propagação de desinformação em "
      "língua portuguesa por meio do desenvolvimento e da avaliação experimental do VeritasAI, um sistema "
      "que decompõe conteúdos noticiosos em afirmações atômicas, recupera evidências na web e as classifica "
      "com Modelos de Linguagem de Grande Escala, oferecendo ao cidadão um veredito fundamentado em fontes "
      "que ele próprio pode consultar.")
    P("Para o alcance do objetivo geral, definem-se os seguintes objetivos específicos:")
    m.bullets([
        "fundamentar teoricamente a verificação automatizada de fatos, a decomposição em afirmações atômicas, "
        "a recuperação de informação e o uso de LLMs com recuperação de evidências;",
        "identificar, na literatura recente, abordagens, resultados e limitações de sistemas de verificação "
        "automatizada, delimitando a lacuna que este trabalho busca preencher;",
        "especificar e implementar um pipeline de verificação de ponta a ponta, com requisitos, arquitetura, "
        "regras de agregação explícitas e mecanismos de reprodutibilidade;",
        "construir um conjunto de avaliação em português com gabarito derivado de checagens de agência "
        "signatária da IFCN, separado em partições de calibração e de teste;",
        "avaliar experimentalmente o desempenho do sistema e testar as hipóteses H1 e H2 por meio da "
        "comparação com variantes sem decomposição e sem recuperação, analisando também custo, latência, "
        "vazamento de gabarito e padrões de falha.",
    ])

    m.h2("1.3 Estrutura do trabalho")
    P("Este trabalho está organizado em seis capítulos. O Capítulo 1 apresenta a contextualização, o "
      "problema de pesquisa, as hipóteses e os objetivos. O Capítulo 2 reúne a fundamentação teórica: "
      "desinformação, verificação de fatos, afirmações atômicas, recuperação de informação e ranqueamento "
      "BM25, RAG, LLMs e métricas de avaliação de classificadores. O Capítulo 3 descreve o levantamento de "
      "trabalhos relacionados e os compara com a proposta.")
    P("O Capítulo 4 apresenta os materiais e métodos: a classificação da pesquisa, as etapas metodológicas, "
      "as tecnologias empregadas (com os relatos dos testes realizados com cada uma) e o desenvolvimento do "
      "sistema, incluindo requisitos, casos de uso, arquitetura, modelo de dados, algoritmos de cada etapa e "
      "telas. O Capítulo 5 descreve os testes de software, o protocolo experimental, os resultados obtidos e "
      "a sua análise frente às hipóteses. Por fim, o Capítulo 6 apresenta as conclusões, o atendimento de "
      "cada objetivo, as limitações e as sugestões de trabalhos futuros.")


# =============================================================================== CAPÍTULO 2
def cap2(m, R):
    P = m.para
    m.h1("2 FUNDAMENTAÇÃO TEÓRICA")
    P("Este capítulo apresenta os conceitos que embasam diretamente o sistema proposto e a sua avaliação. "
      "São abordados, em sequência, a desinformação, a verificação de fatos jornalística e automatizada, as "
      "afirmações atômicas, a recuperação de informação com o modelo BM25, a Geração Aumentada por "
      "Recuperação, os Modelos de Linguagem de Grande Escala e, por fim, as métricas usadas para avaliar "
      "classificadores e a concordância entre avaliadores.")

    m.h2("2.1 Desinformação")
    P("Wardle e Derakhshan (2017) propõem o conceito de desordem informacional e distinguem três tipos de "
      "conteúdo problemático: a *desinformação*, informação falsa criada ou compartilhada com intenção de "
      "causar dano; a *misinformação*, informação falsa compartilhada sem intenção de enganar; e a "
      "*malinformação*, informação verdadeira usada para causar dano, como o vazamento de dados privados. A "
      "distinção é relevante para este trabalho porque um sistema automatizado não tem acesso à intenção de "
      "quem publica: ele avalia apenas a correspondência entre o conteúdo e as evidências disponíveis. Por "
      "isso, o VeritasAI classifica a veracidade do conteúdo, e não a má-fé do autor.")
    P("No ambiente digital, a desinformação é amplificada por mecanismos de recomendação que priorizam o "
      "engajamento. Vosoughi, Roy e Aral (2018), analisando cerca de 126 mil cascatas de boatos no Twitter "
      "entre 2006 e 2017, mostraram que notícias falsas se difundem mais longe, mais rápido e mais "
      "amplamente do que notícias verdadeiras, e que a novidade e as reações emocionais ajudam a explicar o "
      "fenômeno. No Brasil, a difusão é particularmente intensa em aplicativos de mensagens, cujo caráter "
      "privado dificulta o monitoramento. A pesquisa DataSenado (2024) aponta que 81% dos brasileiros "
      "acreditam que notícias falsas podem afetar resultados eleitorais e 91% as consideram um perigo para a "
      "sociedade.")
    P("Duas consequências práticas orientam o projeto do sistema. Primeiro, a desinformação frequentemente "
      "não é inteiramente falsa: ela mistura fatos corretos com números exagerados ou contextos omitidos, o "
      "que justifica uma classe intermediária, IMPRECISO, além de VERDADEIRO e FALSO. Segundo, uma parcela "
      "crescente circula em formatos não textuais (vídeos, imagens, áudios), o que delimita o alcance de um "
      "sistema baseado em texto e é discutido como limitação no Capítulo 6.")

    m.h2("2.2 Verificação de fatos: do jornalismo à automação")
    P("A verificação de fatos (*fact-checking*) é o processo de avaliar a veracidade de afirmações públicas "
      "com base em evidências documentais ou testemunhais. No jornalismo, ela segue etapas reconhecíveis: "
      "selecionar afirmações que mereçam checagem, buscar fontes primárias, consultar especialistas e "
      "publicar a conclusão explicitando as evidências utilizadas (Graves, 2016). A International "
      "Fact-Checking Network (IFCN) mantém um código de princípios (apartidarismo, transparência das fontes, "
      "da metodologia e do financiamento, e política de correções) ao qual as agências signatárias aderem. "
      "Cada agência adota uma escala própria de rótulos; a Lupa, por exemplo, usa selos como Verdadeiro, "
      "Exagerado, Subestimado, Falso, Contraditório e Insustentável.")
    P("No âmbito computacional, a verificação automatizada de fatos (*Automated Fact-Checking*, AFC) busca "
      "reproduzir essas etapas com técnicas de Processamento de Linguagem Natural. Guo, Schlichtkrull e "
      "Vlachos (2022) organizam o campo em um pipeline de três estágios: (i) detecção de afirmações, que "
      "identifica no texto as sentenças que merecem verificação; (ii) recuperação de evidências, que localiza "
      "documentos ou trechos relevantes em fontes externas; e (iii) predição do veredito, frequentemente "
      "acompanhada da geração de uma justificativa. Hassan *et al.* (2017), com o ClaimBuster, mostraram "
      "que a primeira etapa pode ser automatizada com classificadores que estimam o quanto uma sentença é "
      "factual e relevante (*check-worthiness*).")
    P("O estágio de predição costuma ser modelado como classificação em três rótulos. O conjunto de dados "
      "FEVER, com cerca de 185 mil afirmações construídas a partir da Wikipédia, consagrou os rótulos "
      "SUPPORTS, REFUTES e NOT ENOUGH INFO (Thorne *et al.*, 2018). O AVeriTeC aproximou a tarefa do mundo "
      "real, com afirmações extraídas de checagens jornalísticas e evidências buscadas na web aberta, "
      "acrescentando o rótulo de evidência conflitante (Schlichtkrull; Guo; Vlachos, 2023). O VeritasAI "
      "adota, no nível da afirmação, os rótulos SUPORTADA, CONTRADITA e INSUFICIENTE, equivalentes aos três "
      "do FEVER; o caso de evidências conflitantes é tratado como INSUFICIENTE, por prudência.")
    P("A diferença fundamental entre a checagem jornalística e a automatizada está na relação entre escala "
      "e profundidade: enquanto uma equipe verifica dezenas de afirmações por semana com apuração própria, "
      "um sistema automatizado processa um conteúdo em segundos ou minutos, mas depende exclusivamente do "
      "que estiver publicado e indexado no momento da consulta. Por essa razão, sistemas automatizados são "
      "mais bem descritos como ferramentas de triagem e apoio à decisão do que como substitutos da checagem "
      "profissional.")

    m.h2("2.3 Afirmações atômicas e decomposição")
    P("Uma afirmação atômica é uma unidade mínima de informação factual que pode ser verificada de forma "
      "independente das demais (Min *et al.*, 2023). A decomposição de um texto em afirmações atômicas evita "
      "que uma informação verdadeira mascare outra falsa no mesmo parágrafo: o texto “O prefeito "
      "inaugurou 40 escolas em 2025, o dobro de 2024” contém duas afirmações (a quantidade de escolas "
      "inauguradas em 2025 e a comparação com 2024), e cada uma pode ter um veredito diferente.")
    P("Min *et al.* (2023) propuseram o FActScore, que mede a precisão factual de textos longos como a "
      "fração de afirmações atômicas suportadas por uma fonte de conhecimento, e mostraram que a avaliação "
      "por átomos é mais informativa do que um julgamento binário do texto inteiro. Wei *et al.* (2024) "
      "estenderam a ideia com o SAFE (*Search-Augmented Factuality Evaluator*): um LLM decompõe o texto em "
      "afirmações, gera consultas ao Google para cada uma e decide, com base nos resultados, se ela é "
      "suportada. Zhang e Gao (2023) obtiveram ganhos ao instruir o LLM a dividir afirmações complexas em "
      "subquestões verificadas passo a passo.")
    P("A granularidade é crítica. Afirmações muito amplas (“o governo adotou medidas contra a "
      "crise”) dependem de múltiplos fatos e são difíceis de verificar; afirmações muito específicas "
      "podem não ter evidência pública. Além disso, uma afirmação extraída de seu contexto pode se tornar "
      "ambígua: “ele cortou o orçamento” não é verificável sem saber quem é “ele” e "
      "quando o corte ocorreu. Choi *et al.* (2021) denominam *descontextualização* a reescrita de uma "
      "sentença para que ela seja interpretável isoladamente, resolvendo pronomes e explicitando sujeito, "
      "data e local. No VeritasAI, essa propriedade é exigida explicitamente no prompt de extração "
      "(seção 4.4.6): cada afirmação deve ser autocontida e conter um único fato.")

    m.h2("2.4 Recuperação de informação e o modelo BM25")
    P("A Recuperação de Informação (*Information Retrieval*, IR) estuda métodos para localizar, em grandes "
      "coleções, os documentos relevantes para uma necessidade de informação expressa por uma consulta "
      "(Manning; Raghavan; Schütze, 2008). Em um sistema de verificação de fatos, a IR atua em dois níveis: "
      "na busca, que encontra páginas da web potencialmente relevantes para cada afirmação, e na seleção de "
      "trechos, que identifica, dentro dessas páginas, as passagens que de fato tratam do fato verificado.")
    P("Os modelos clássicos de IR representam documentos e consultas como conjuntos de termos. A "
      "frequência do termo (*term frequency*, TF) mede quantas vezes um termo aparece em um documento, e a "
      "frequência inversa de documento (*inverse document frequency*, IDF) atribui mais peso a termos "
      "raros na coleção, que discriminam melhor os documentos. O BM25 (*Best Matching 25*), derivado do "
      "modelo probabilístico de relevância, combina essas grandezas com saturação da frequência e "
      "normalização pelo tamanho do documento (Robertson; Zaragoza, 2009). A pontuação de um documento "
      "*D* para uma consulta *Q* com termos q₁, …, qₙ é dada pela Equação 1:")
    m.equation(["BM25(D, Q) = ", ("sum", ["i=1"], ["n"], ["IDF(", ("sub", "q", "i"), ") · ",
               ("frac", ["f(", ("sub", "q", "i"), ", D) · (", ("sub", "k", "1"), " + 1)"],
                        ["f(", ("sub", "q", "i"), ", D) + ", ("sub", "k", "1"), " · (1 − b + b · ",
                         ("frac", ["|D|"], ["avgdl"]), ")"])])])
    P("em que f(qᵢ, D) é a frequência do termo qᵢ em *D*, |D| é o número de termos do documento, *avgdl* "
      "é o tamanho médio dos documentos da coleção, e k₁ e *b* são parâmetros: k₁ controla a saturação "
      "(a partir de certo ponto, repetir um termo pouco acrescenta) e *b* controla a normalização pelo "
      "tamanho (b = 0 desliga a normalização; b = 1 a aplica integralmente). Os valores k₁ = 1,5 e b = 0,75 "
      "são usuais na literatura (Robertson; Zaragoza, 2009) e foram adotados neste trabalho. O IDF é "
      "calculado pela Equação 2, em que *N* é o número de documentos da coleção e n(qᵢ) é o número de "
      "documentos que contêm qᵢ:")
    m.equation(["IDF(", ("sub", "q", "i"), ") = ln(1 + ",
                ("frac", ["N − n(", ("sub", "q", "i"), ") + 0,5"], ["n(", ("sub", "q", "i"), ") + 0,5"]), ")"])
    P("O BM25 é lexical: ele reconhece correspondências entre palavras, mas não entre sinônimos ou "
      "paráfrases. Alternativas densas, baseadas em vetores de *embeddings*, capturam similaridade "
      "semântica, mas exigem um modelo adicional e são menos interpretáveis. A escolha do BM25 para a "
      "seleção de trechos, e não de um LLM ou de *embeddings*, é justificada na seção 4.4.7 por critérios de "
      "custo, determinismo e reprodutibilidade.")

    m.h2("2.5 Geração Aumentada por Recuperação")
    P("A Geração Aumentada por Recuperação (RAG) combina um componente de recuperação, que seleciona "
      "documentos relevantes para a entrada, com um modelo gerador que os recebe como contexto (Lewis *et "
      "al.*, 2020). Em vez de depender apenas do conhecimento armazenado nos parâmetros do modelo durante o "
      "treinamento, que pode estar desatualizado ou incorreto, a resposta é condicionada a evidências "
      "obtidas no momento da consulta. Gao *et al.* (2023) distinguem o RAG “ingênuo” (recuperar, "
      "concatenar e gerar) de variantes avançadas que reescrevem a consulta antes da busca, reordenam ou "
      "filtram os trechos recuperados e restringem explicitamente a resposta ao contexto fornecido.")
    P("O VeritasAI implementa um RAG avançado nesse sentido: (i) a consulta de busca não é o texto bruto da "
      "afirmação, mas uma reformulação gerada pelo LLM com as entidades, datas e números principais; (ii) os "
      "trechos das páginas são reordenados pelo BM25 e filtrados por um critério mínimo de relevância; e "
      "(iii) o prompt de verificação instrui o modelo a usar apenas as evidências fornecidas e a responder "
      "INSUFICIENTE quando elas não bastarem. Cada evidência recebe um identificador (E1, E2, …), e o modelo "
      "deve indicar quais identificadores sustentam a sua decisão, o que torna cada veredito rastreável até "
      "as fontes.")

    m.h2("2.6 Modelos de Linguagem de Grande Escala")
    P("LLMs são redes neurais treinadas sobre grandes volumes de texto para prever o próximo *token* de "
      "uma sequência. A arquitetura predominante é o *Transformer* (Vaswani *et al.*, 2017), cujo mecanismo "
      "de autoatenção (*self-attention*) pondera a relevância de cada *token* em relação aos demais da "
      "sequência, superando limitações das redes recorrentes no tratamento de dependências de longo alcance "
      "(Alammar; Grootendorst, 2024). O treinamento ocorre tipicamente em duas fases: o pré-treinamento "
      "sobre texto não rotulado e o ajuste fino por instruções e por reforço com *feedback* humano, que "
      "alinha as respostas às intenções do usuário (Raschka, 2024; Ouyang *et al.*, 2022).")
    P("Com a escala surgem habilidades emergentes (Wei *et al.*, 2022a), entre elas o aprendizado em "
      "contexto, em que o modelo executa uma tarefa descrita no próprio prompt, com poucos exemplos "
      "(*few-shot*) ou nenhum (*zero-shot*), sem ajuste de pesos, e o raciocínio em cadeia de pensamento "
      "(*chain-of-thought*), em que o modelo produz etapas intermediárias antes da resposta (Wei *et al.*, "
      "2022b). Modelos recentes executam esse raciocínio internamente antes de responder, consumindo "
      "*tokens* adicionais que também são cobrados, o que afeta o custo de sistemas baseados em LLM e é "
      "medido no Capítulo 5.")
    P("Três propriedades dos LLMs são decisivas para o projeto de um verificador. A primeira é a "
      "**alucinação**: o modelo pode gerar afirmações plausíveis e incorretas, pois o conhecimento está "
      "distribuído nos pesos e não vinculado a fontes (Ji *et al.*, 2023). A segunda é o **corte de "
      "conhecimento**: o modelo desconhece fatos posteriores à coleta dos dados de treinamento (Raschka, "
      "2024). A terceira é o **não determinismo**: a geração é uma amostragem de uma distribuição de "
      "probabilidade, controlada por parâmetros como a temperatura; com temperatura zero, o modelo tende a "
      "escolher o *token* mais provável, o que reduz, mas não elimina, a variação entre execuções. As duas "
      "primeiras propriedades motivam o uso de RAG; a terceira motiva o cache de respostas e o registro das "
      "versões de prompt adotados para a reprodutibilidade dos experimentos (seção 4.4.10).")
    P("Por fim, os LLMs podem ser instruídos a responder em formatos estruturados, como JSON, o que permite "
      "validar automaticamente a saída contra um esquema e rejeitar respostas malformadas. Setty (2024) "
      "observa que modelos menores ajustados para a tarefa podem superar LLMs genéricos na classificação "
      "de afirmações quando há dados rotulados em abundância; em português, porém, esses dados são escassos "
      "(Gomes, 2025), o que favorece a abordagem *zero-shot* adotada.")

    m.h2("2.7 Avaliação de classificadores e concordância")
    P("A avaliação de um classificador multiclasse parte da **matriz de confusão**, em que a célula (i, j) "
      "conta os exemplos da classe real *i* atribuídos à classe *j*. Para cada classe *k*, definem-se os "
      "verdadeiros positivos (VPₖ, exemplos de *k* classificados como *k*), os falsos positivos (FPₖ, "
      "exemplos de outras classes classificados como *k*) e os falsos negativos (FNₖ, exemplos de *k* "
      "classificados como outra classe). A partir deles, calculam-se a precisão, a revocação e o F1 de cada "
      "classe (Sokolova; Lapalme, 2009), nas Equações 3, 4 e 5:")
    m.equation([("sub", "Precisão", "k"), " = ", ("frac", [("sub", "VP", "k")], [("sub", "VP", "k"), " + ", ("sub", "FP", "k")])])
    m.equation([("sub", "Revocação", "k"), " = ", ("frac", [("sub", "VP", "k")], [("sub", "VP", "k"), " + ", ("sub", "FN", "k")])])
    m.equation([("sub", "F1", "k"), " = 2 · ", ("frac", [("sub", "Precisão", "k"), " · ", ("sub", "Revocação", "k")],
                                                   [("sub", "Precisão", "k"), " + ", ("sub", "Revocação", "k")])])
    P("A precisão responde “quando o sistema diz FALSO, com que frequência acerta?”; a revocação "
      "responde “dos conteúdos realmente falsos, quantos o sistema encontrou?”. A acurácia é a "
      "fração de acertos sobre o total, e o **F1 macro** é a média aritmética simples do F1 das *K* classes "
      "(Equação 6). Ao dar o mesmo peso a todas as classes, o F1 macro penaliza um sistema que acerta muito "
      "uma classe e ignora outra, o que a acurácia isolada não revela:")
    m.equation(["Acurácia = ", ("frac", [("sum", ["k"], [""], [("sub", "VP", "k")])], ["n"]),
                "        F1 macro = ", ("frac", ["1"], ["K"]), " ", ("sum", ["k=1"], ["K"], [("sub", "F1", "k")])])
    P("Para medir a concordância entre dois avaliadores (por exemplo, o sistema e um anotador humano), "
      "usa-se o **Kappa de Cohen** (Equação 7), que desconta da concordância observada pₒ a concordância "
      "esperada ao acaso pₑ, calculada a partir das distribuições marginais de cada avaliador (Cohen, "
      "1960). Landis e Koch (1977) propõem a interpretação: abaixo de 0,20, concordância leve; de 0,21 a "
      "0,40, razoável; de 0,41 a 0,60, moderada; de 0,61 a 0,80, substancial; acima de 0,80, quase "
      "perfeita.")
    m.equation(["κ = ", ("frac", [("sub", "p", "o"), " − ", ("sub", "p", "e")], ["1 − ", ("sub", "p", "e")])])
    P("Quando dois classificadores são avaliados sobre os mesmos exemplos, a comparação de suas acurácias "
      "deve considerar o pareamento. O **teste de McNemar** (McNemar, 1947) considera apenas os pares "
      "discordantes: *b*, o número de exemplos que o classificador A acerta e B erra, e *c*, o número de "
      "exemplos que B acerta e A erra. Sob a hipótese nula de desempenho igual, *b* segue uma distribuição "
      "binomial com parâmetros (b + c; 0,5); para amostras pequenas, usa-se o teste binomial exato. Por fim, "
      "um **estudo de ablação** avalia a contribuição de um componente removendo-o e medindo a variação de "
      "desempenho; é o desenho que operacionaliza as hipóteses H1 e H2 deste trabalho.")


# =============================================================================== CAPÍTULO 3
def cap3(m, R, img):
    P = m.para
    m.h1("3 TRABALHOS RELACIONADOS")
    P("A busca por trabalhos relacionados foi realizada nas bases Google Scholar, arXiv, ACL Anthology, ACM "
      "Digital Library e em repositórios institucionais de universidades brasileiras (UFG e UNESP). Foram "
      "utilizadas as palavras-chave *automated fact-checking*, *claim extraction*, *claim decomposition*, "
      "*LLM fact verification*, *RAG fact-checking*, *fake news detection* e, em português, *verificação de "
      "fatos* e *detecção de notícias falsas*, combinadas com os operadores AND e OR. Foram incluídos "
      "trabalhos publicados nos últimos dez anos que descrevessem um pipeline computacional de verificação "
      "com resultados experimentais; foram excluídos os que tratavam apenas de detecção de estilo (sem "
      "evidências) ou de mídias não textuais. Dos trabalhos encontrados, seis foram selecionados por "
      "proximidade com a proposta, quatro em língua inglesa e dois em português, apresentados a seguir e "
      "comparados ao final.")

    m.h2("3.1 Evidence-backed Fact Checking using RAG and Few-Shot In-Context Learning with LLMs")
    P("Singhal *et al.* (2024) propuseram um sistema de verificação que combina RAG com aprendizado em "
      "contexto por poucos exemplos. Sobre o conjunto AVeriTeC, o sistema recupera os três documentos mais "
      "relevantes para cada afirmação, extrai deles evidências com um LLM que formula perguntas e respostas e, "
      "em seguida, classifica a afirmação em Suportada, Refutada, Evidência Conflitante ou Evidência "
      "Insuficiente com exemplos rotulados no prompt. O sistema alcançou pontuação AVeriTeC de 0,33, uma "
      "melhoria de 22% sobre o *baseline* oficial (Figura 1).")
    m.figure(img[1], "Pipeline RAG com aprendizado em contexto", "Singhal *et al.* (2024).", 14)
    P("O trabalho demonstra que é possível construir verificadores competitivos sem treinamento "
      "supervisionado extenso, o que é relevante para línguas com poucos recursos rotulados. Como "
      "limitação, opera sobre um corpus de documentos fornecido pelo conjunto de dados, e não sobre a web "
      "aberta, e recebe afirmações já isoladas, sem decompor um texto jornalístico. O VeritasAI incorpora a "
      "ideia de evidências identificadas e citadas pelo modelo e acrescenta a extração de afirmações e a "
      "busca dinâmica.")

    m.h2("3.2 ClaimCheck: Real-Time Fact-Checking with Small Language Models")
    P("Putta, Devasier e Li (2025) propuseram o ClaimCheck, um sistema de verificação em tempo real que "
      "usa um modelo pequeno (Qwen3-4B) em um pipeline modular que reproduz o fluxo humano: planejamento de "
      "consultas na web, recuperação e sumarização de evidências, síntese com possibilidade de nova busca e "
      "avaliação do veredito (Figura 2). O trabalho mostra que modelos menores, otimizados por módulo, "
      "produzem verificações interpretáveis com custo computacional muito menor do que sistemas baseados em "
      "modelos de grande porte.")
    m.figure(img[2], "Arquitetura modular do ClaimCheck", "Putta, Devasier e Li (2025).", 14)
    P("A arquitetura modular, em que cada componente pode ser substituído isoladamente, inspirou a "
      "organização do VeritasAI em serviços com dependências injetadas. Como limitação, o ClaimCheck "
      "verifica afirmações individuais fornecidas pelo usuário, em inglês, sem decompor artigos completos. O "
      "VeritasAI difere ao automatizar a cadeia inteira, da entrada do conteúdo ao veredito agregado.")

    m.h2("3.3 Long-form factuality in large language models (SAFE)")
    P("Wei *et al.* (2024) propuseram o SAFE (*Search-Augmented Factuality Evaluator*), método que usa um "
      "LLM para (i) decompor uma resposta longa em fatos individuais, (ii) revisar cada fato para que seja "
      "autocontido, (iii) verificar se ele é relevante para a pergunta e (iv) avaliar se é suportado, "
      "enviando consultas iterativas à Busca do Google e raciocinando sobre os resultados. Em cerca de 16 mil "
      "fatos, o SAFE concordou com anotadores humanos em 72% dos casos e, em uma amostra de 100 casos de "
      "discordância, esteve correto em 76% deles, a um custo mais de 20 vezes menor do que a anotação "
      "humana.")
    P("O SAFE é, entre os trabalhos analisados, o mais próximo do VeritasAI em desenho: decomposição por "
      "LLM, descontextualização das afirmações e busca aberta na web. Sua finalidade, contudo, é avaliar a "
      "factualidade de textos gerados por LLMs, em inglês, e não verificar notícias para o público; ele não "
      "produz um veredito agregado em classes interpretáveis nem expõe trechos de evidência ao usuário. O "
      "VeritasAI aplica o mesmo princípio a conteúdos noticiosos em português e acrescenta uma regra de "
      "agregação explícita e uma interface voltada ao cidadão.")

    m.h2("3.4 Verificação semiautomática de fatos em português")
    P("Gomes (2025), em dissertação de mestrado na Universidade Federal de Goiás, investigou a verificação "
      "semiautomática de fatos em português com foco no enriquecimento de corpus. O trabalho explorou a "
      "extração de alegações em português brasileiro e o uso de buscadores para recuperar documentos "
      "relacionados, com o objetivo de ampliar os conjuntos de dados de checagem disponíveis no idioma, "
      "escassos em comparação aos de língua inglesa (Figura 3).")
    m.figure(img[3], "Metodologia de enriquecimento de corpus", "Gomes (2025).", 13)
    P("O trabalho confirma a viabilidade da extração de alegações e da recuperação de documentos em "
      "português, mas seu foco é a construção de recursos, com etapas que dependem de intervenção humana, e "
      "não a produção de um veredito automatizado para o usuário. O VeritasAI parte da mesma constatação, a "
      "escassez de dados rotulados em português, e por isso adota LLMs em modo *zero-shot*, sem treinamento "
      "supervisionado.")

    m.h2("3.5 Automated Fake News Detection using Cross-Checking with Reliable Sources")
    P("Ghadiri *et al.* (2022) propuseram um sistema que imita o comportamento humano de conferir uma "
      "informação nova em fontes conhecidas: dado um *tweet*, o sistema localiza notícias relacionadas em "
      "um conjunto predefinido de veículos confiáveis e usa um classificador *Random Forest* para decidir "
      "se o conteúdo está alinhado a elas (Figura 4). O sistema alcançou 70% de acurácia, superando "
      "classificadores genéricos da época.")
    m.figure(img[4], "Pipeline de verificação cruzada com fontes confiáveis", "Ghadiri *et al.* (2022).", 14)
    P("O princípio de conferir o conteúdo contra fontes externas é o mesmo do VeritasAI. Como limitações, o "
      "*Random Forest* opera sobre atributos superficiais e não captura relações semânticas finas, e o "
      "sistema foi desenhado para textos curtos de rede social, com uma lista fechada de fontes. O VeritasAI "
      "substitui o classificador por um LLM instruído a comparar afirmação e evidência e substitui a lista "
      "fechada por busca aberta, mantendo a lista de domínios confiáveis apenas como opção de priorização.")

    m.h2("3.6 Detecção de fake news em português utilizando inferência de linguagem natural")
    P("Morini, Kido e Coan (2023) propuseram a detecção de notícias falsas em português por Inferência de "
      "Linguagem Natural (*Natural Language Inference*, NLI): notícias já verificadas atuam como premissa e "
      "a notícia suspeita como hipótese; se o modelo identifica contradição entre ambas, a notícia é "
      "classificada como falsa (Figura 5). A relação premissa-hipótese é explícita e inspecionável.")
    m.figure(img[5], "Pipeline de classificação textual por NLI", "Morini, Kido e Coan (2023).", 14)
    P("A principal limitação é a dependência de um corpus curado de notícias verdadeiras, que precisa ser "
      "atualizado continuamente e não cobre eventos recentes. A verificação do VeritasAI é conceitualmente "
      "equivalente a uma NLI entre a afirmação (hipótese) e os trechos de evidência (premissas), com a "
      "diferença de que as premissas são buscadas na web no momento da consulta.")

    m.h2("3.7 Comparativo entre os trabalhos relacionados")
    P("O Quadro 1 compara os trabalhos analisados com o VeritasAI segundo os critérios mais relevantes para "
      "a proposta: idioma, busca na web no momento da consulta, decomposição automática em afirmações, "
      "aceitação de um conteúdo completo como entrada, emissão de veredito agregado, exibição das "
      "evidências ao usuário e uso de LLM.")
    m.table("Quadro", "Comparativo entre os trabalhos relacionados e o VeritasAI",
            ["Trabalho", "Idioma", "Busca na web", "Decom-posição", "Conteúdo completo", "Veredito agregado",
             "Evidências expostas", "LLM"],
            [["Singhal et al. (2024)", "EN", "Não", "Não", "Não", "Não", "Sim", "Sim"],
             ["ClaimCheck (2025)", "EN", "Sim", "Não", "Não", "Não", "Sim", "Sim"],
             ["SAFE (2024)", "EN", "Sim", "Sim", "Sim", "Parcial¹", "Não", "Sim"],
             ["Gomes (2025)", "PT", "Sim", "Sim", "Parcial", "Não", "Parcial", "Parcial"],
             ["Ghadiri et al. (2022)", "EN", "Não²", "Não", "Não", "Sim", "Não", "Não"],
             ["Morini, Kido e Coan (2023)", "PT", "Não", "Não", "Sim", "Sim", "Parcial", "Não"],
             ["VeritasAI", "PT", "Sim", "Sim", "Sim", "Sim", "Sim", "Sim"]],
            "Elaborado pelo autor (2026). ¹ Proporção de fatos suportados, sem classes de veredito. "
            "² Busca restrita a uma lista fechada de veículos.",
            widths=[3.6, 1.3, 1.6, 1.6, 1.8, 1.8, 1.8, 1.2])
    P("A análise evidencia que nenhum dos trabalhos reúne, simultaneamente, operação em português, busca "
      "aberta na web, decomposição automática de um conteúdo completo, veredito agregado em classes "
      "interpretáveis e exposição das evidências ao usuário. Essa é a lacuna que o VeritasAI busca "
      "preencher. Os trabalhos também deixam uma lição metodológica: nenhum deles isola, por ablação, o "
      "efeito da decomposição sobre o veredito final de uma notícia, o que motiva a hipótese H1 e o desenho "
      "experimental do Capítulo 5.")
