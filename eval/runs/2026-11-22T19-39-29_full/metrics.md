# Métricas — variante `full`, split `calibracao`

- Notícias avaliadas: **15** de 15 (0 com falha, fora das métricas)
- Acurácia: **40.0%**
- Macro-F1: **0.403**
- Limiares: os da execução

## Por classe

| Classe | Precisão | Revocação | F1 | Suporte |
|---|---|---|---|---|
| VERDADEIRO | 0.333 | 0.400 | 0.364 | 5 |
| FALSO | 0.400 | 0.400 | 0.400 | 5 |
| IMPRECISO | 0.500 | 0.400 | 0.444 | 5 |

## Matriz de confusão (linhas = gabarito, colunas = sistema)

| | VERDADEIRO | FALSO | IMPRECISO |
|---|---|---|---|
| **VERDADEIRO** | 2 | 1 | 2 |
| **FALSO** | 3 | 2 | 0 |
| **IMPRECISO** | 1 | 2 | 2 |

## Referências de comparação

| Referência | Acurácia |
|---|---|
| Este sistema (`full`) | 40.0% |
| Pessoas julgando veracidade (OCDE, 2024) | 60.0% |
| Ghadiri et al. (2022) | 70.0% |
| Sempre a classe majoritária (VERDADEIRO) | 33.3% |
| Chute uniforme em 3 classes | 33.3% |
