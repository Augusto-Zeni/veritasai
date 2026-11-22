# Gerador do texto do TCC II

Monta `TCC2_VeritasAI.docx` (ABNT) a partir dos resultados em `eval/runs/`. Tabelas, números e o Kappa
são lidos dos artefatos da avaliação; nada é digitado à mão.

```bash
python3 -m venv /tmp/tccvenv && /tmp/tccvenv/bin/pip install python-docx matplotlib pillow
# pasta de trabalho com fig/, telas/ e orig_img/ (copiar de docs/diagramas/png, docs/telas e img_trabalhos_relacionados)
/tmp/tccvenv/bin/python docs/tcc/gerador/build.py <repo> <pasta-de-trabalho> ~/Downloads/TCC2_VeritasAI.docx
```

Ao abrir no Word, aceite "atualizar campos" para recalcular sumário e listas.
