# Métricas — variante `full`, split `calibracao`

- Notícias avaliadas: **15** de 15 (0 com falha, fora das métricas)
- Acurácia: **53.3%**
- Macro-F1: **0.422**
- Limiares: os da execução

## Por classe

| Classe | Precisão | Revocação | F1 | Suporte |
|---|---|---|---|---|
| VERDADEIRO | 0.500 | 1.000 | 0.667 | 5 |
| FALSO | 0.000 | 0.000 | 0.000 | 5 |
| IMPRECISO | 0.600 | 0.600 | 0.600 | 5 |

## Matriz de confusão (linhas = gabarito, colunas = sistema)

| | VERDADEIRO | FALSO | IMPRECISO |
|---|---|---|---|
| **VERDADEIRO** | 5 | 0 | 0 |
| **FALSO** | 3 | 0 | 2 |
| **IMPRECISO** | 2 | 0 | 3 |

## Referências de comparação

| Referência | Acurácia |
|---|---|
| Este sistema (`full`) | 53.3% |
| Pessoas julgando veracidade (OCDE, 2024) | 60.0% |
| Ghadiri et al. (2022) | 70.0% |
| Sempre a classe majoritária (VERDADEIRO) | 33.3% |
| Chute uniforme em 3 classes | 33.3% |
