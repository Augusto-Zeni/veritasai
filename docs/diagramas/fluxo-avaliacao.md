# Fluxo da avaliação (Capítulo 5)

```mermaid
flowchart TD
  DS[("eval/dataset/noticias.csv<br/>60 notícias · gabarito das agências")]
  DS -->|split = calibracao<br/>15 notícias| RC
  DS -->|split = teste<br/>45 notícias| RT

  subgraph Calibracao["1 · Calibração (só no split de calibração)"]
    RC["pnpm eval:run<br/>--variant full --split calibracao"]
    CAL["pnpm eval:calibrate --run …<br/>busca em grade · maximiza macro-F1"]
    RC --> CAL
    CAL --> TH[/"calibration.json<br/>limiares calibrados"/]
  end

  subgraph Teste["2 · Teste (resultados finais)"]
    RT["pnpm eval:run --split teste<br/>uma execução por variante"]
    V1[full]
    V2[full-no-factcheck-domains]
    V3[no-decomposition]
    V4[no-retrieval]
    RT --> V1 & V2 & V3 & V4
    V1 & V2 --> MC["pnpm eval:metrics … --thresholds calibration.json<br/>(recalcula vereditos, sem APIs)"]
    V3 & V4 --> M["metrics.md · costs.json · errors.md"]
    MC --> M
  end
  TH -.-> MC

  subgraph Afirmacoes["3 · Nível da afirmação"]
    S["pnpm eval:sample-claims<br/>100 afirmações · seed 42"]
    H["Rotulação manual cega<br/>(Augusto)"]
    K["pnpm eval:kappa<br/>acurácia + Kappa de Cohen"]
    S --> H --> K
  end
  V1 --> S

  M --> TCC[["Capítulo 5<br/>tabelas e discussão"]]
  K --> TCC
```

## Leitura dos resultados

| Comparação                           | Pergunta respondida                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `full` × `no-decomposition`          | Decompor em afirmações atômicas melhora o veredito? (hipótese)                |
| `full` × `no-retrieval`              | Buscar evidências melhora em relação ao conhecimento interno do LLM?          |
| `full` × `full-no-factcheck-domains` | Quanto do acerto vem de encontrar a própria checagem (vazamento de gabarito)? |
