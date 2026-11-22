# Métricas — variante `no-retrieval`, split `teste`

- Notícias avaliadas: **45** de 45 (0 com falha, fora das métricas)
- Acurácia: **46.7%**
- Macro-F1: **0.443**
- Limiares: os da execução

## Por classe

| Classe | Precisão | Revocação | F1 | Suporte |
|---|---|---|---|---|
| VERDADEIRO | 0.625 | 0.333 | 0.435 | 15 |
| FALSO | 0.462 | 0.800 | 0.585 | 15 |
| IMPRECISO | 0.364 | 0.267 | 0.308 | 15 |

## Matriz de confusão (linhas = gabarito, colunas = sistema)

| | VERDADEIRO | FALSO | IMPRECISO |
|---|---|---|---|
| **VERDADEIRO** | 5 | 5 | 5 |
| **FALSO** | 1 | 12 | 2 |
| **IMPRECISO** | 2 | 9 | 4 |

## Referências de comparação

| Referência | Acurácia |
|---|---|
| Este sistema (`no-retrieval`) | 46.7% |
| Pessoas julgando veracidade (OCDE, 2024) | 60.0% |
| Ghadiri et al. (2022) | 70.0% |
| Sempre a classe majoritária (VERDADEIRO) | 33.3% |
| Chute uniforme em 3 classes | 33.3% |
