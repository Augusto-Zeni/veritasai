# Métricas — variante `no-decomposition`, split `teste`

- Notícias avaliadas: **45** de 45 (0 com falha, fora das métricas)
- Acurácia: **48.9%**
- Macro-F1: **0.453**
- Limiares: os da execução

## Por classe

| Classe | Precisão | Revocação | F1 | Suporte |
|---|---|---|---|---|
| VERDADEIRO | 0.800 | 0.267 | 0.400 | 15 |
| FALSO | 0.800 | 0.267 | 0.400 | 15 |
| IMPRECISO | 0.400 | 0.933 | 0.560 | 15 |

## Matriz de confusão (linhas = gabarito, colunas = sistema)

| | VERDADEIRO | FALSO | IMPRECISO |
|---|---|---|---|
| **VERDADEIRO** | 4 | 0 | 11 |
| **FALSO** | 1 | 4 | 10 |
| **IMPRECISO** | 0 | 1 | 14 |

## Referências de comparação

| Referência | Acurácia |
|---|---|
| Este sistema (`no-decomposition`) | 48.9% |
| Pessoas julgando veracidade (OCDE, 2024) | 60.0% |
| Ghadiri et al. (2022) | 70.0% |
| Sempre a classe majoritária (VERDADEIRO) | 33.3% |
| Chute uniforme em 3 classes | 33.3% |
