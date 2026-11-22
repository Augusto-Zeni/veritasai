# Rotulação manual das afirmações

Amostra de 98 afirmações sorteadas com semente 42 da execução `eval/runs/2026-11-22T19-49-41_full`.

1. Abra **afirmacoes_para_rotular.csv** e preencha a coluna `rotulo_manual` de cada linha com:
   - `SUPORTADA` (ou `S`): as evidências listadas confirmam a afirmação;
   - `CONTRADITA` (ou `C`): as evidências listadas contradizem a afirmação;
   - `INSUFICIENTE` (ou `I`): as evidências não permitem decidir.
2. Julgue **somente com as evidências da coluna `evidencias`** (o mesmo que o sistema recebeu).
   Assim o Kappa mede a etapa de classificação (Verification) isoladamente.
3. **Não abra `rotulos_sistema.csv`** antes de terminar (rotulação cega, evita viés de ancoragem).
4. Use `observacao` para anotar casos difíceis (servem para a análise qualitativa).
5. Depois rode: `pnpm eval:kappa -- --sample eval/runs/2026-11-22T19-49-41_full/amostra-afirmacoes`
