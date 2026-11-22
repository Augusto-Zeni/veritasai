"""Capítulo 4 – Materiais e métodos."""


def cap4(m, R, fig, tela):
    P = m.para
    m.h1("4 MATERIAIS E MÉTODOS")
    P("Este capítulo descreve a classificação da pesquisa, as etapas metodológicas que relacionam cada "
      "objetivo específico a um procedimento, as tecnologias empregadas, com os testes realizados para "
      "validá-las, e o desenvolvimento do sistema VeritasAI: requisitos, casos de uso, arquitetura, modelo "
      "de dados, algoritmos de cada etapa do pipeline, interface e salvaguardas éticas.")

    # ------------------------------------------------------------------ 4.1
    m.h2("4.1 Classificação da pesquisa")
    P("Quanto à **natureza**, a pesquisa é aplicada, pois gera conhecimento voltado à solução de um "
      "problema concreto, a verificação de conteúdos noticiosos em português (Gil, 2022). Quanto à "
      "**abordagem**, é quali-quantitativa. A dimensão quantitativa está nas métricas calculadas sobre um "
      "conjunto de teste com gabarito: acurácia, precisão, revocação, F1 por classe, F1 macro, Kappa de "
      "Cohen, custo e latência. A dimensão qualitativa está na análise interpretativa dos casos de erro e "
      "da qualidade das evidências recuperadas, que explica os números e orienta melhorias.")
    P("Quanto aos **objetivos**, a pesquisa é exploratória: investiga um campo pouco explorado em "
      "português, a verificação automatizada com LLMs e busca aberta, e busca estabelecer bases para "
      "trabalhos futuros, sem pretender resultados definitivos (Gil, 2022). Quanto aos **procedimentos**, "
      "é experimental: constrói-se um sistema e manipula-se, de forma controlada, a presença de seus "
      "componentes (decomposição, recuperação e exclusão de domínios de checagem), medindo o efeito sobre o "
      "desempenho. Cada variante sem um componente atua como grupo de controle da variante completa, "
      "sobre os mesmos itens, o que caracteriza um desenho de medidas pareadas (Wazlawick, 2014). "
      "Complementarmente, a pesquisa é bibliográfica, na fundamentação e nos trabalhos relacionados, e "
      "documental, na construção do gabarito a partir de checagens publicadas por agência de checagem.")

    m.h2("4.2 Etapas da pesquisa")
    P("O Quadro 2 relaciona cada objetivo específico (seção 1.2) ao procedimento adotado, ao produto "
      "gerado e ao capítulo em que é apresentado. Ele serve também como roteiro de verificação do "
      "atendimento dos objetivos no Capítulo 6.")
    m.table("Quadro", "Relação entre objetivos específicos, procedimentos e resultados",
            ["Objetivo específico", "Procedimento", "Produto", "Cap."],
            [["a) Fundamentar teoricamente", "Pesquisa bibliográfica", "Fundamentação teórica", "2"],
             ["b) Identificar abordagens e lacunas", "Busca em bases com palavras-chave e critérios de inclusão",
              "Análise e quadro comparativo de seis trabalhos", "3"],
             ["c) Especificar e implementar o pipeline", "Engenharia de requisitos, projeto arquitetural, "
              "implementação incremental com testes automatizados", "Sistema VeritasAI (núcleo, API, interface, "
              "scripts de avaliação)", "4"],
             ["d) Construir o conjunto de avaliação", "Pesquisa documental em checagens da Lupa; mapeamento de "
              "rótulos; sorteio estratificado", "60 itens com gabarito, partições de calibração e teste", "5"],
             ["e) Avaliar e testar H1 e H2", "Experimento com quatro variantes, calibração de limiares, "
              "métricas, teste de McNemar, análise qualitativa", "Tabelas, matrizes de confusão, custos e "
              "análise de erros", "5"]],
            "Elaborado pelo autor (2026).", widths=[4.2, 5.2, 4.8, 1.0], align_center_from=3)

    # ------------------------------------------------------------------ 4.3
    m.h2("4.3 Tecnologias")
    P("As tecnologias foram escolhidas segundo três critérios: (i) custo nulo ou baixo no período de "
      "desenvolvimento e avaliação; (ii) adequação técnica a cada etapa do pipeline; e (iii) domínio prévio "
      "do autor, para concentrar o esforço na pesquisa. Cada serviço externo fica atrás de uma interface "
      "própria no código, de modo que possa ser substituído sem alterar o restante do sistema. O Quadro 3 "
      "resume as escolhas, detalhadas a seguir com os testes realizados e os problemas encontrados.")
    m.table("Quadro", "Tecnologias empregadas no VeritasAI",
            ["Camada", "Tecnologia", "Função no sistema"],
            [["Linguagem e ambiente", "TypeScript (modo strict) sobre o ambiente de execução Node.js 24 LTS",
              "Todo o código: núcleo, API, avaliação e interface"],
             ["Modelo de linguagem", "Google Gemini (gemini-3.8-flash), SDK @google/genai",
              "Extração de afirmações, geração de consultas e verificação"],
             ["Busca na web", "Serper.dev (resultados do Google)", "Recuperação de páginas candidatas"],
             ["Extração de texto", "Jina Reader; Mozilla Readability + linkedom (alternativa)",
              "Texto principal de notícias e de páginas de evidência"],
             ["Validação", "Zod", "Esquemas de domínio e validação das saídas do LLM"],
             ["Persistência", "SQLite (better-sqlite3)", "Cache de verificações e de respostas externas"],
             ["API", "Fastify 5 + Server-Sent Events", "Recebe pedidos e transmite o progresso"],
             ["Interface", "React + Vite, Tailwind CSS, shadcn/ui", "Telas web responsivas"],
             ["Qualidade", "Vitest, ESLint, Prettier; pnpm workspaces", "Testes sem rede, padronização, monorepo"]],
            "Elaborado pelo autor (2026).", widths=[3.2, 6.0, 6.0], align_center_from=9)

    m.h3("4.3.1 TypeScript e Node.js")
    P("O sistema é escrito em TypeScript, um superconjunto tipado da linguagem JavaScript, compilado com "
      "verificação estrita de tipos e proibição do tipo `any`. O código é executado pelo Node.js, que não é "
      "uma linguagem, mas um ambiente de execução (*runtime*) de JavaScript fora do navegador, baseado no "
      "motor V8. Adotou-se a versão 24, de suporte estendido (LTS). A tipagem estática foi decisiva para "
      "manter consistentes os tipos de domínio compartilhados entre o núcleo, a API, a interface e os "
      "scripts de avaliação.")
    P("Dois testes de ambiente orientaram decisões registradas no diário de desenvolvimento. O TypeScript "
      "7, versão mais recente no início do projeto, não era suportado pela ferramenta de análise estática "
      "(typescript-eslint), e o projeto foi fixado na versão 6, privilegiando a análise com regras tipadas. "
      "Além disso, o gerenciador de pacotes pnpm precisou ser instalado diretamente, pois o Corepack deixou "
      "de acompanhar o Node.js a partir da versão 25.")

    m.h3("4.3.2 Google Gemini")
    P("O modelo de linguagem é o Gemini, do Google, acessado pela Gemini API com o SDK oficial "
      "`@google/genai`. Foi adotada a versão `gemini-3.8-flash`, da família Flash, voltada a baixo custo e "
      "latência, com código de versão fixo, para que atualizações silenciosas do provedor não alterem os "
      "resultados. Todas as chamadas usam temperatura 0 e semente fixa (42), resposta em JSON e validação "
      "da resposta por esquema Zod; uma resposta inválida é repetida e nunca é armazenada em cache.")
    P("Os testes com a API revelaram três fatos que alteraram o planejamento do TCC I. Primeiro, os limites "
      "do plano gratuito, citados na proposta como 15 requisições por minuto e 1 milhão de *tokens* por dia, "
      "foram reduzidos diversas vezes desde dezembro de 2025, e o Google deixou de publicar valores fixos "
      "por modelo (Google, 2026); por isso, os limites passaram a ser configuráveis (`LLM_RPM` e `LLM_RPD`), "
      "e o desenvolvimento foi feito com 5 requisições por minuto e 100 por dia. Como uma única variante do "
      "experimento consome centenas de chamadas, a avaliação final foi executada no plano pago, com "
      "créditos de aproximadamente R$ 120, e o consumo real foi medido (seção 5.7). Segundo, os modelos "
      "Flash atuais executam raciocínio interno antes de responder, e esses *tokens* são cobrados como "
      "saída; o sistema os soma ao consumo registrado. Terceiro, no primeiro teste real, a API respondeu "
      "repetidamente com erro 503 (alta demanda), o que levou à implementação de repetição com espera "
      "exponencial e à possibilidade de retomar uma avaliação interrompida.")

    m.h3("4.3.3 Serper.dev")
    P("A recuperação de páginas usa a Serper.dev, uma API sobre os resultados da Busca do Google que "
      "retorna JSON com título, trecho (*snippet*), URL e data de cada resultado. As consultas usam os "
      "parâmetros `gl=br` e `hl=pt-br`, que regionalizam os resultados para o Brasil e o português. O plano "
      "gratuito oferece 2.500 consultas, suficientes para o projeto graças ao cache. Um teste com o operador "
      "`-site:` para excluir domínios mostrou que ele não separa seções de um portal (por exemplo, "
      "`g1.globo.com/fato-ou-fake` do restante do `g1.globo.com`); por isso, a exclusão é feita filtrando os "
      "dez resultados devolvidos por consulta, o que também permite reaproveitar a mesma busca em variantes "
      "com e sem exclusão.")

    m.h3("4.3.4 Jina Reader e Readability")
    P("A extração do texto principal de uma página usa o Jina Reader (`r.jina.ai`), que recebe uma URL e "
      "devolve o conteúdo sem menus, anúncios e rodapés, em formato markdown. Ao contrário do previsto no "
      "TCC I, o serviço passou a ser usado com chave de API, que eleva o limite de requisições. Quando o "
      "Jina falha ou devolve menos de 500 caracteres, o sistema recorre à biblioteca Readability, da "
      "Mozilla, executada localmente sobre o HTML baixado.")
    P("Esta foi a etapa com o problema mais instrutivo do desenvolvimento. No primeiro teste com as APIs "
      "reais, nenhuma página era extraída: o Jina devolvia bytes comprimidos ilegíveis e o Readability "
      "parava em um redirecionamento HTTP 301. A investigação mostrou que a biblioteca jsdom, usada para "
      "montar o HTML para o Readability, trazia como dependência uma versão do cliente HTTP undici que, ao "
      "ser carregada, substituía o despachante global do `fetch` nativo do Node.js por um sem "
      "descompressão nem redirecionamentos, afetando todas as requisições do processo, inclusive as do "
      "Gemini e da Serper. Os testes automatizados não detectaram o defeito porque usam respostas gravadas, "
      "sem rede. A solução foi substituir o jsdom pelo linkedom, mais leve e sem essa dependência, e criar "
      "um teste de regressão. A lição incorporada ao método foi executar um teste de fumaça com as APIs "
      "reais antes de cada avaliação.")
    P("Um segundo episódio ocorreu durante a própria avaliação: ao executar quatro variantes em paralelo, "
      "o Jina passou a responder HTTP 429 (excesso de requisições), mesmo com cinco tentativas por página. O "
      "sistema degradou como projetado, recorrendo ao Readability ou ao *snippet* do buscador, mas as "
      "evidências obtidas eram piores. As execuções parciais foram descartadas e as variantes foram "
      "reexecutadas em sequência, sem nenhum erro 429.")

    m.h3("4.3.5 Fastify, React e demais ferramentas")
    P("A API usa o Fastify 5, escolhido pelo desempenho e pela integração com TypeScript, e transmite o "
      "progresso por *Server-Sent Events* (SSE), um padrão HTML em que o servidor envia eventos por uma "
      "conexão HTTP comum e o navegador reconecta automaticamente (WHATWG, 2026). Como o fluxo do pipeline "
      "é unidirecional, do servidor para o cliente, o SSE é mais simples do que WebSocket. A interface usa "
      "React com Vite, Tailwind CSS e componentes shadcn/ui, que são copiados para o repositório e "
      "construídos sobre a biblioteca Radix UI, com suporte a teclado e atributos de acessibilidade. A "
      "validação de dados usa Zod: os tipos de domínio são definidos uma única vez como esquemas, que servem "
      "para validar as saídas do LLM, o cache e os arquivos de resultado, e para gerar os tipos do código.")
    P("Para a persistência, o TCC I previa PostgreSQL com a extensão pgvector. Durante o desenvolvimento, "
      "verificou-se que o sistema não precisa de banco de dados relacional: não há dados de usuário, por "
      "decisão de projeto, e a busca por similaridade vetorial não se mostrou necessária. A persistência foi "
      "reduzida a um cache em SQLite, um arquivo local acessado pela biblioteca better-sqlite3, sem servidor "
      "a instalar ou manter (seção 4.4.4). Os testes usam o Vitest, e o código é organizado em um monorepo "
      "com pnpm workspaces.")

    # ------------------------------------------------------------------ 4.4
    m.h2("4.4 Desenvolvimento")
    P("O desenvolvimento seguiu um processo incremental: domínio e regras de agregação com testes; "
      "clientes de serviços externos com cache e controle de taxa; serviços do pipeline, um a um, testados "
      "com respostas gravadas; orquestração e linha de comando; scripts de avaliação; API; e interface. "
      "Esta seção descreve o resultado desse processo.")

    m.h3("4.4.1 Requisitos")
    P("Os requisitos foram levantados a partir do problema de pesquisa, dos trabalhos relacionados e das "
      "restrições éticas e de custo do projeto. Os Quadros 4 e 5 apresentam os requisitos funcionais (RF) e "
      "não funcionais (RNF), classificados segundo Sommerville (2019).")
    m.table("Quadro", "Requisitos funcionais",
            ["ID", "Requisito"],
            [["RF01", "Receber a URL de uma notícia ou o texto de um conteúdo e extrair o texto a verificar."],
             ["RF02", "Decompor o conteúdo em até 10 afirmações atômicas, autocontidas e factuais."],
             ["RF03", "Gerar uma consulta de busca em português para cada afirmação."],
             ["RF04", "Buscar evidências na web, excluindo sempre o domínio do próprio conteúdo."],
             ["RF05", "Selecionar, nas páginas encontradas, os trechos mais relevantes para cada afirmação."],
             ["RF06", "Classificar cada afirmação como SUPORTADA, CONTRADITA ou INSUFICIENTE, indicando as "
                      "evidências usadas."],
             ["RF07", "Agregar as classificações em um veredito VERDADEIRO, FALSO ou IMPRECISO, com score e "
                      "cobertura."],
             ["RF08", "Exibir o progresso de cada etapa em tempo real."],
             ["RF09", "Exibir o veredito, a explicação, as afirmações e as evidências com título, domínio, "
                      "trecho e link."],
             ["RF10", "Executar o sistema em lote sobre um conjunto de dados, em variantes de ablação, e "
                      "calcular métricas."],
             ["RF11", "Calibrar os limiares de agregação apenas na partição de calibração."]],
            "Elaborado pelo autor (2026).", widths=[1.5, 13.7], align_center_from=9)
    m.table("Quadro", "Requisitos não funcionais",
            ["ID", "Categoria", "Requisito"],
            [["RNF01", "Privacidade", "Não coletar dados de usuário: sem cadastro, login, cookies de "
                                     "rastreamento ou registro de IP."],
             ["RNF02", "Transparência", "Nenhum veredito sem as evidências que o sustentam."],
             ["RNF03", "Reprodutibilidade", "Prompts versionados; configuração, modelo e commit salvos com cada "
                                           "resultado; cache de respostas externas."],
             ["RNF04", "Custo", "Respeitar limites por minuto e por dia; repetir com espera exponencial em "
                               "erros 429 e 5xx."],
             ["RNF05", "Robustez", "A falha em uma afirmação não derruba a verificação: ela vira "
                                  "INSUFICIENTE com o motivo registrado."],
             ["RNF06", "Testabilidade", "Testes automatizados sem rede e sem chamadas a APIs reais."],
             ["RNF07", "Acessibilidade", "Contraste AA, navegação por teclado, veredito com ícone e texto "
                                        "além da cor, layout responsivo."],
             ["RNF08", "Segurança", "Recusar URLs de rede interna (proteção contra SSRF) e não expor "
                                   "mensagens internas de erro."]],
            "Elaborado pelo autor (2026).", widths=[1.6, 3.0, 10.6], align_center_from=9)

    m.h3("4.4.2 Casos de uso")
    P("A Figura 6 apresenta o diagrama de casos de uso. Há dois atores humanos: o **usuário**, cidadão que "
      "verifica um conteúdo pela interface web (UC01 a UC05), e o **pesquisador**, que executa a avaliação "
      "experimental por linha de comando (UC06 a UC09). Os casos de verificação e de execução de variante "
      "incluem o caso UC10, que executa o pipeline e depende de três sistemas externos: Gemini, Serper e "
      "Jina.")
    m.figure(fig["casos_uso"], "Diagrama de casos de uso do VeritasAI", "Elaborado pelo autor (2026).", 15.5)
    P("O caso UC01 resume o fluxo principal: (1) o usuário cola a URL e aciona “Verificar”; (2) a "
      "API valida a URL e devolve um identificador; (3) a interface abre o fluxo de eventos e exibe as "
      "etapas à medida que são concluídas; (4) ao final, exibe o veredito, a explicação e a lista de "
      "afirmações com suas evidências. Os fluxos alternativos são: URL inválida ou de rede interna, "
      "rejeitada com mensagem; fila cheia, com resposta 503 e indicação de nova tentativa; texto não "
      "extraível ou nenhuma afirmação factual encontrada, situações que encerram a verificação com uma "
      "mensagem explicativa; e resultado já presente no cache, devolvido imediatamente, sem novo consumo de "
      "cota.")

    m.h3("4.4.3 Arquitetura")
    P("O sistema é um monorepo com três aplicações sobre um núcleo comum (Figura 7). O pacote "
      "`packages/core` contém o pipeline puro, sem HTTP, e é usado tanto pela API quanto pelos scripts de "
      "avaliação. Isso garante que o sistema avaliado no Capítulo 5 seja exatamente o mesmo exposto ao "
      "usuário. O núcleo é organizado em camadas: serviços, um por etapa do pipeline; clientes, que "
      "encapsulam os serviços externos atrás das interfaces `LlmClient`, `SearchClient` e `ReaderClient`; e "
      "infraestrutura, com cache, prompts versionados e configuração. Os serviços recebem suas dependências "
      "pelo construtor, o que permite substituí-las por implementações falsas nos testes.")
    m.figure(fig["arquitetura"], "Arquitetura de componentes do VeritasAI", "Elaborado pelo autor (2026).", 15.5)
    P("Os clientes são compostos em camadas: o `CachedLlmClient` consulta o cache antes de delegar ao "
      "`GeminiClient`, que passa por um `RateLimiter` com limites por minuto e por dia; o `FallbackReader` "
      "tenta o Jina e, se necessário, o Readability. As falhas de serviços externos são convertidas em erros "
      "tipados (`ScrapeError`, `LlmQuotaError`, entre outros), e o pipeline decide como degradar: a falha na "
      "extração do texto ou das afirmações encerra a verificação, pois não há o que verificar; a falha em "
      "uma afirmação a torna INSUFICIENTE, com o motivo registrado.")

    m.h3("4.4.4 Modelo de dados e persistência")
    P("Por decisão de projeto (RNF01), o VeritasAI não possui entidades de usuário, e por isso não há "
      "modelo entidade-relacionamento de cadastro. Os dados persistidos limitam-se a duas tabelas de cache "
      "em SQLite (Figura 8a). A tabela `verification_cache` guarda o resultado completo de uma verificação, "
      "indexado pelo *hash* da URL normalizada e pelo *hash* da configuração (modelo, versões de prompt e "
      "limiares); assim, alterar qualquer um desses elementos invalida automaticamente os resultados "
      "antigos. A tabela `llm_cache` guarda cada resposta externa, indexada pelo *hash* do prompt e pelo "
      "modelo. Além das respostas do Gemini, ela armazena as buscas da Serper e as páginas lidas pelo Jina e "
      "pelo Readability, de modo que uma reexecução do experimento recebe exatamente as mesmas entradas.")
    m.figure(fig["modelo_dados"], "Modelo de dados: (a) tabelas de cache; (b) tipos de domínio",
             "Elaborado pelo autor (2026).", 15.5)
    P("A Figura 8b mostra os tipos de domínio, definidos como esquemas Zod. Um `VerificationResult` contém o "
      "artigo, a lista de `ClaimResult` (afirmação, consulta, evidências, rótulo e justificativa), o score, "
      "a cobertura, o veredito, a explicação e o `meta`, com modelo, versões dos prompts, configuração, "
      "consumo de *tokens*, latência por etapa e avisos. As verificações em andamento na API ficam apenas em "
      "memória e expiram 15 minutos após terminarem.")

    m.h3("4.4.5 Visão geral do pipeline")
    P("A Figura 9 apresenta o fluxo de uma verificação. As etapas 1 a 3 são executadas uma vez por "
      "conteúdo; as etapas 4 a 6, uma vez por afirmação, com até três afirmações em paralelo; e a etapa 7 "
      "agrega os resultados. As subseções seguintes detalham cada etapa, e os prompts completos estão no "
      "Apêndice A.")
    m.figure(fig["pipeline"], "Fluxo de uma verificação no pipeline do VeritasAI", "Elaborado pelo autor (2026).", 15.5)
    P("O número de chamadas ao LLM por conteúdo é 2 + N, em que *N* é o número de afirmações: uma para a "
      "extração, uma para as consultas de todas as afirmações e uma verificação por afirmação que tenha "
      "evidências. Com o máximo de 10 afirmações, são até 12 chamadas por conteúdo.")

    m.h3("4.4.6 Extração do texto e das afirmações")
    P("O `ScraperService` normaliza a URL, removendo parâmetros de rastreamento (`utm_*`) e fragmentos, "
      "para que a mesma notícia compartilhada com parâmetros diferentes corresponda a uma única entrada no "
      "cache. Em seguida, tenta o Jina e, se o resultado tiver menos de 500 caracteres, o Readability. O "
      "texto é truncado em 20.000 caracteres, e o método usado e a ocorrência de truncamento são "
      "registrados. Quando o conteúdo é fornecido como texto, essa etapa é dispensada e o método registrado "
      "é `texto`.")
    P("O `ClaimExtractionService` envia o texto ao LLM com o prompt de extração (Apêndice A), que impõe as "
      "propriedades discutidas na seção 2.3: cada afirmação deve conter um único fato, ser autocontida, com "
      "pronomes resolvidos e sujeito, data e local explícitos quando presentes no texto, e ser factual, "
      "descartando opiniões, previsões e promessas. Na versão 2 do prompt, adotada na avaliação final, duas "
      "regras tratam de declarações: verifica-se o conteúdo do que foi dito, e não o fato de ter sido dito "
      "(“X disse que o desemprego caiu 10%” gera “o desemprego caiu 10% em <período>”), e "
      "não se geram afirmações sobre o contexto da fala, como o cargo do autor ou a ocorrência da entrevista. "
      "A versão 1 tratava “X afirmou que Y” como fato sobre a declaração; a seção 5.3 relata o "
      "experimento que motivou a mudança. A saída é um JSON validado por esquema, com no máximo 10 "
      "afirmações, cada uma acompanhada da frase de origem no texto.")

    m.h3("4.4.7 Geração de consultas, busca e seleção de evidências")
    P("O `QueryGenerationService` gera, em uma única chamada, uma consulta por afirmação, com 4 a 12 "
      "palavras, contendo as entidades, os números e as datas principais, e sem termos que enviesem a busca, "
      "como “falso” ou “checagem”. Se a chamada falhar, o próprio texto da afirmação é "
      "usado como consulta. O `SearchService` envia a consulta à Serper e mantém os cinco primeiros "
      "resultados após a exclusão do domínio da origem e, quando a opção `EXCLUDE_FACTCHECK_DOMAINS` está "
      "ativa, dos domínios de agências de checagem (Quadro 6).")
    m.table("Quadro", "Domínios de agências de checagem excluídos na variante sem agências",
            ["Domínios"],
            [["agencialupa.org; lupa.uol.com.br; piaui.folha.uol.com.br; aosfatos.org; "
              "estadao.com.br/estadao-verifica; noticias.uol.com.br/confere; checamos.afp.com; "
              "projetocomprova.com.br; g1.globo.com/fato-ou-fake; boatos.org; e-farsas.com"]],
            "Elaborado pelo autor (2026), a partir de `config.ts`.", widths=[15.2], align_center_from=9)
    P("O `EvidenceService` lê até três páginas por afirmação, divide o texto em trechos de 60 a 600 "
      "caracteres, compostos de frases inteiras com sobreposição de uma frase entre trechos consecutivos, e "
      "ranqueia todos os trechos de todas as páginas da afirmação pelo BM25 (Equações 1 e 2), usando o texto "
      "da afirmação como consulta e k₁ = 1,5 e b = 0,75. O IDF é calculado sobre o conjunto de trechos da "
      "afirmação, de modo que termos presentes em todas as páginas pesam menos. Os termos passam por "
      "normalização simples: minúsculas, remoção de acentos, de palavras vazias (*stopwords*, como "
      "“de” e “para”) e de palavras com menos de três letras, e remoção do “s” final "
      "em palavras longas. Um trecho só é aceito se contiver pelo menos dois termos distintos da afirmação, ou "
      "25% deles, o que for maior (limitado ao total de termos da afirmação); são mantidos até três trechos por "
      "página. Se uma página não puder ser lida, por exigir assinatura ou bloquear leitura automatizada, o "
      "*snippet* do buscador é submetido ao mesmo filtro e usado em seu lugar.")
    P("No TCC I, a seleção de trechos seria feita pelo LLM. A troca pelo BM25 foi uma decisão de custo e de "
      "método: com o LLM, seriam até três chamadas extras por afirmação, cerca de 30 por notícia, o que "
      "tornaria a avaliação inviável no plano gratuito; o BM25, por sua vez, é determinístico e "
      "inspecionável, o que facilita a análise de erros. A alternativa de reordenar os trechos por "
      "*embeddings* é indicada como trabalho futuro.")

    m.h3("4.4.8 Verificação das afirmações")
    P("O `VerificationService` envia ao LLM apenas a afirmação e os trechos de evidência, identificados como "
      "E1, E2 etc., com título, domínio e data. O prompt (Apêndice A) instrui o modelo a usar somente as "
      "evidências fornecidas, sem conhecimento prévio, e a responder INSUFICIENTE quando elas não bastarem; "
      "define critérios para cada rótulo (por exemplo, um número ou data não mencionado nas evidências leva "
      "a INSUFICIENTE, e não a SUPORTADA); e exige a resposta `{label, rationale, evidenceIdsUsed}`. "
      "Identificadores inexistentes, eventualmente inventados pelo modelo, são descartados. Quando não há "
      "nenhuma evidência, o rótulo INSUFICIENTE é atribuído sem chamar o LLM, o que economiza cota sem "
      "alterar o resultado.")

    m.h3("4.4.9 Agregação do veredito")
    P("O `ScoringService` agrega os rótulos das afirmações em um veredito único. Sejam nₛ o número de "
      "afirmações SUPORTADAS, n_c o de CONTRADITAS, nᵢ o de INSUFICIENTES e N = nₛ + n_c + nᵢ o total. "
      "Definem-se dois indicadores, o **score** *s* (Equação 8) e a **cobertura** *c* (Equação 9):")
    m.equation(["s = ", ("frac", [("sub", "n", "s"), " − ", ("sub", "n", "c")], [("sub", "n", "s"), " + ", ("sub", "n", "c")]),
                ",   s ∈ [−1, 1]"])
    m.equation(["c = ", ("frac", [("sub", "n", "s"), " + ", ("sub", "n", "c")], ["N"]), ",   c ∈ [0, 1]"])
    P("O score mede o saldo entre afirmações confirmadas e desmentidas, considerando apenas as que tiveram "
      "evidência conclusiva: s = 1 quando todas foram suportadas, s = −1 quando todas foram contraditas e "
      "s = 0 em caso de empate. Quando nₛ + n_c = 0, o score é indefinido e o veredito é IMPRECISO. A "
      "cobertura é a proporção de afirmações com evidência conclusiva; uma cobertura de 0,5 significa que "
      "**50% das afirmações** tiveram evidência suficiente para serem classificadas como SUPORTADA ou "
      "CONTRADITA. O veredito é definido por três limiares configuráveis: o conteúdo é VERDADEIRO se "
      "c ≥ COVERAGE_MIN e s ≥ TRUE_MIN; FALSO se c ≥ COVERAGE_MIN e s ≤ FALSE_MAX; e IMPRECISO nos demais "
      "casos.")
    P("Os valores iniciais, COVERAGE_MIN = 0,5 (50% das afirmações com evidência), TRUE_MIN = 0,5 e "
      "FALSE_MAX = −0,3, são assimétricos por escolha conservadora: basta uma minoria relevante de "
      "afirmações contraditas para afastar o veredito de VERDADEIRO. Por exemplo, com 4 afirmações "
      "suportadas e 1 contradita, s = 3/5 = 0,6, e o veredito é VERDADEIRO; com 3 suportadas e 2 contraditas, "
      "s = 0,2, e o veredito é IMPRECISO. A Figura 10 mostra as regiões de decisão no plano (c, s). Os limiares "
      "foram depois calibrados na partição de calibração (seção 5.3).")
    m.figure(fig["scoring"], "Regiões de decisão do veredito no plano cobertura × score (limiares iniciais)",
             "Elaborado pelo autor (2026).", 12)
    P("A agregação é uma função pura, coberta por testes unitários em todas as fronteiras, por exemplo "
      "s = 0,5 exato, c = 0,5 exato e s = −0,3 exato. A comparação com os limiares usa tolerância de 10⁻⁹, "
      "para que erros de ponto flutuante não desloquem casos de fronteira, como 3/10 = 0,3. A explicação "
      "exibida ao usuário é gerada por modelo de texto a partir das contagens, e não pelo LLM: assim, ela "
      "nunca contradiz o veredito calculado e não consome cota.")

    m.h3("4.4.10 Reprodutibilidade, cota e tratamento de erros")
    P("Como o código também produz as evidências científicas deste trabalho, a reprodutibilidade foi "
      "tratada como requisito (RNF03). Os prompts ficam em arquivos markdown com identificador e versão no "
      "cabeçalho, e qualquer alteração de texto exige nova versão; as versões usadas vão para o `meta` de "
      "cada resultado. Cada execução da avaliação grava um `config.json` com a configuração, as versões dos "
      "prompts, o modelo, o *hash* do conjunto de dados e o commit do código, e recusa ser retomada se algum "
      "desses elementos tiver mudado, o que impede misturar resultados de versões diferentes.")
    P("As chamadas externas passam por repetição com espera exponencial e variação aleatória (*jitter*), "
      "de 1 a 60 segundos, com até cinco tentativas; se a API informar o tempo de espera, ele é respeitado. "
      "O erro 429 por cota diária esgotada não é repetido, pois repetir apenas desperdiçaria tempo. Na "
      "avaliação, vale um modo estrito: se qualquer afirmação de um item falhar, o item inteiro é separado "
      "para nova tentativa, pois uma afirmação que virasse INSUFICIENTE por falta de cota alteraria o "
      "veredito e contaminaria as métricas.")

    m.h3("4.4.11 API e interface")
    P("A API expõe quatro rotas (Quadro 7). A criação de uma verificação é separada da transmissão do "
      "progresso: `POST /verify` devolve imediatamente um identificador, e `GET /verify/:id/stream` abre o "
      "fluxo SSE. Essa separação permite reconectar sem perder eventos, pois o servidor guarda o histórico "
      "de cada verificação e reenvia os eventos posteriores ao último recebido (cabeçalho `Last-Event-ID`), "
      "e abrir o mesmo resultado em outra aba. A API processa uma verificação por vez, já que a cota do LLM é "
      "o gargalo, com fila limitada, e reaproveita a verificação em andamento quando a mesma URL é "
      "solicitada novamente.")
    m.table("Quadro", "Rotas da API",
            ["Rota", "Descrição"],
            [["POST /verify", "Recebe {url}, valida, enfileira e responde 202 com o identificador; 400 para URL "
                              "inválida ou de rede interna; 503 com Retry-After se a fila estiver cheia."],
             ["GET /verify/:id/stream", "Fluxo SSE com os eventos stage, article, claims, claim-done, cache-hit, "
                                       "result e error."],
             ["GET /verify/:id", "Estado atual da verificação (para recarregar a página)."],
             ["GET /health", "Indica se a API está pronta e, se não estiver, o motivo (por exemplo, chave ausente)."]],
            "Elaborado pelo autor (2026).", widths=[4.4, 10.8], align_center_from=9)
    P("A interface possui quatro telas: início, progresso, resultado e “Como funciona”. A tela de "
      "progresso exibe as etapas da Figura 9 (extraindo texto, extraindo afirmações, buscando evidências com "
      "contador n/N, classificando e agregando), marcadas à medida que os eventos SSE chegam. As demais são "
      "apresentadas nas Figuras 11 a 13; a tela de resultado mostra uma verificação real de uma notícia da "
      "Agência Brasil sobre o crescimento de conteúdos falsos criados com IA. O veredito é comunicado por ícone, texto e cor, de modo que não "
      "depende só da cor. O score e a cobertura são traduzidos para linguagem simples, como “7 de 9 "
      "afirmações tiveram evidências”, e exibidos em barras que mostram os limiares aplicados. As "
      "evidências usadas na decisão são destacadas e listadas primeiro. A interface oferece tema claro e "
      "escuro, respeita a preferência por menos movimento e foi projetada prioritariamente para celular.")
    for key, title in (("inicio", "Tela inicial com campo de URL e aviso permanente"),
                       ("resultado", "Tela de resultado com veredito, afirmações e evidências"),
                       ("sobre", "Tela “Como funciona”, com o método e as limitações")):
        m.figure(tela[key], title, "Elaborado pelo autor (2026).", 14)

    m.h3("4.4.12 Salvaguardas éticas")
    P("O sistema é apresentado explicitamente como ferramenta de apoio à decisão, complementar, e não "
      "substituta, ao trabalho das agências de checagem. Todas as fontes de cada verificação são exibidas "
      "com link, o que permite a inspeção independente das evidências, em linha com o princípio de "
      "transparência da IFCN. O resultado é decomposto em três níveis, veredito, rótulo de cada afirmação e "
      "evidências, para que o usuário exerça o próprio julgamento em vez de delegá-lo ao algoritmo, e a "
      "falta de evidências leva intencionalmente a IMPRECISO, e não a uma classificação forçada.")
    P("A interface exibe um aviso permanente: o resultado se baseia em evidências públicas disponíveis no "
      "momento da consulta; o modelo pode errar, ter vieses ou alucinar; a verificação não substitui a "
      "checagem profissional; e o usuário deve consultar as fontes citadas. O sistema não coleta dados "
      "pessoais nem registra o texto das notícias nos logs, e o veredito não representa uma avaliação "
      "editorial ou jurídica do conteúdo, não devendo ser usado como instrumento de censura.")
