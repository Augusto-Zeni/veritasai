# Calibração dos limiares — `full` (15 notícias de calibração)

| | Cobertura mín. | s mín. (VERDADEIRO) | s máx. (FALSO) | Macro-F1 | Acurácia |
|---|---|---|---|---|---|
| Padrão | 0.5 | 0.5 | -0.3 | 0.403 | 40.0% |
| **Calibrado** | 0.5 | 0.5 | -0.3 | 0.403 | 40.0% |

- Combinações avaliadas: 700; empatadas com a melhor: 160.
- Critério: maior macro-F1 → maior acurácia → mais próximo dos limiares padrão.
- ⚠ Muitos empates: há pouca informação no split de calibração para distinguir os limiares (risco de sobreajuste).
