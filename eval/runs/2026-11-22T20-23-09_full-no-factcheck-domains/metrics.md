# Métricas — variante `full-no-factcheck-domains`, split `teste`

- Notícias avaliadas: **45** de 45 (0 com falha, fora das métricas)
- Acurácia: **31.1%**
- Macro-F1: **0.316**
- Limiares: os da execução

## Por classe

| Classe | Precisão | Revocação | F1 | Suporte |
|---|---|---|---|---|
| VERDADEIRO | 0.571 | 0.267 | 0.364 | 15 |
| FALSO | 0.286 | 0.267 | 0.276 | 15 |
| IMPRECISO | 0.250 | 0.400 | 0.308 | 15 |

## Matriz de confusão (linhas = gabarito, colunas = sistema)

| | VERDADEIRO | FALSO | IMPRECISO |
|---|---|---|---|
| **VERDADEIRO** | 4 | 1 | 10 |
| **FALSO** | 3 | 4 | 8 |
| **IMPRECISO** | 0 | 9 | 6 |

## Referências de comparação

| Referência | Acurácia |
|---|---|
| Este sistema (`full-no-factcheck-domains`) | 31.1% |
| Pessoas julgando veracidade (OCDE, 2024) | 60.0% |
| Ghadiri et al. (2022) | 70.0% |
| Sempre a classe majoritária (VERDADEIRO) | 33.3% |
| Chute uniforme em 3 classes | 33.3% |
