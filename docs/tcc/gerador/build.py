"""Monta o TCC II: python build.py <repo> <scratch> <saida.docx>"""
import csv, os, re, statistics as st, subprocess, sys, importlib
from collections import Counter

REPO, S, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, os.path.join(S, "tools"))
import abnt, content_a, content_b, content_c, content_refs, results
try:
    import discussion
    T = discussion.texts
except ImportError:
    T = lambda R, D: {}

R = results.load_all(REPO)

# ------------------------------------------------------------------ dataset
rows = list(csv.DictReader(open(os.path.join(REPO, "eval/dataset/noticias.csv"))))
L = [len(r["texto"]) for r in rows]
years = Counter(r["data_publicacao"][:4] for r in rows)
temas = sorted(set(r["tema"] for r in rows), key=lambda t: -sum(1 for r in rows if r["tema"] == t))
tema_rows = [[t.capitalize(), str(sum(1 for r in rows if r["tema"] == t and r["split"] == "calibracao")),
              str(sum(1 for r in rows if r["tema"] == t and r["split"] == "teste")),
              str(sum(1 for r in rows if r["tema"] == t))] for t in temas]
tema_rows.append(["**Total**", "15", "45", "60"])
calib_md = ""
for d in sorted(os.listdir(os.path.join(REPO, "eval/runs"))):
    p = os.path.join(REPO, "eval/runs", d, "calibration.md")
    if os.path.exists(p):
        calib_md = open(p).read()  # o último (v2)
ties = re.search(r"empatadas com a melhor: (\d+)", calib_md)
# contagem de testes
tests, test_files = "241", "35"
try:
    out = subprocess.run(["pnpm", "test"], cwd=REPO, capture_output=True, text=True, timeout=300).stdout
    tests = re.search(r"Tests\s+(\d+) passed", out).group(1)
    test_files = re.search(r"Test Files\s+(\d+) passed", out).group(1)
except Exception as e:
    print("! testes:", e)

D = dict(len_median=str(st.median(L)).replace(".0", "").replace(".", ","), len_min=min(L), len_max=max(L),
         speakers=len(Counter(r["titulo"].split(":")[0] for r in rows)),
         y2024=years["2024"], y2025=years["2025"], y2026=years["2026"], tema_rows=tema_rows,
         calib_ties=ties.group(1) if ties else "?", tests=tests, test_files=test_files)

# ------------------------------------------------------------------ figuras
fig = {k: os.path.join(S, "fig", f"fig_{k}.png") for k in ("arquitetura", "pipeline", "casos_uso", "modelo_dados", "scoring")}
tela = {k: os.path.join(S, "telas", f"{k}.png") for k in ("inicio", "progresso", "resultado", "sobre")}
tela = {k: v for k, v in tela.items() if os.path.exists(v)}
img = {i: os.path.join(S, "orig_img", f) for i, f in enumerate(sorted(
    [f for f in os.listdir(os.path.join(S, "orig_img")) if not f.startswith("img1_") and not f.startswith("img7_")],
    key=lambda f: int(f.split("_")[0][3:])), start=1)}

TR = content_c.test_runs(R)
import glob as _g, json as _j
for _kp in _g.glob(os.path.join(REPO, "eval/runs/*/amostra-afirmacoes/kappa.json")):
    _k = _j.load(open(_kp))
    if _k.get("n"):
        D["kappa"] = dict(n=_k["n"], accuracy=_k["accuracy"], kappa=_k["kappa"], interp=_k["interpretation"],
                          unlabeled=_k.get("unlabeled", 0), confusion=_k.get("confusion"))
nofc_run = TR.get("full-no-factcheck-domains")
if nofc_run:
    from collections import Counter as _C
    cats = _C()
    for r in nofc_run["recs"]:
        e, p_ = r["expected"], r["result"]["verdict"]; c = r["result"]["coverage"]
        if e == p_:
            continue
        if {e, p_} == {"VERDADEIRO", "FALSO"}: cats["inv"] += 1
        elif e == "IMPRECISO" and p_ == "FALSO": cats["exa"] += 1
        elif c < 0.5 - 1e-9: cats["cob"] += 1
        else: cats["per"] += 1
    D["erros_quadro"] = [
        ["Cobertura insuficiente (menos de 50% das afirmações com evidência conclusiva)", str(cats["cob"]),
         "N008 (verdadeiro): fala sobre corte federal em telemedicina; nenhuma evidência tratava do corte "
         "específico, e as três afirmações ficaram INSUFICIENTES."],
        ["Exagero classificado como falsidade (IMPRECISO → FALSO)", str(cats["exa"]),
         "N039 (Exagerado): \u201cpouco mais de 4 milhões\u201d de jovens tiraram o título em 2022; as evidências "
         "indicavam cerca de 2 milhões, e a afirmação foi CONTRADITA, sem rótulo para \u201cexagerado\u201d."],
        ["Afirmação periférica contradita", str(cats["per"]),
         "N013 (verdadeiro): o núcleo (criação da Controladoria e da carreira própria) foi SUPORTADO, mas o "
         "detalhe \u201cdesbaratou a máfia do ISS em três meses\u201d foi CONTRADITO (foram dez meses)."],
        ["Inversão do veredito (VERDADEIRO ↔ FALSO)", str(cats["inv"]),
         "N070 (falso): \u201cninguém imaginava que Vorcaro estivesse envolvido em fraudes\u201d foi decomposta em "
         "\u201cVorcaro esteve envolvido em fraudes\u201d, verdadeira; a decomposição perdeu o núcleo da fala."],
    ]
if all(TR.values()):
    import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    names = ["Completo", "Sem agências", "Sem\ndecomposição", "Sem\nrecuperação"]
    keys = ["full", "full-no-factcheck-domains", "no-decomposition", "no-retrieval"]
    acc = [TR[k]["cls"]["accuracy"] * 100 for k in keys]; f1 = [TR[k]["cls"]["macroF1"] * 100 for k in keys]
    lo = [a - TR[k]["acc_ci"][0] * 100 for a, k in zip(acc, keys)]; hi = [TR[k]["acc_ci"][1] * 100 - a for a, k in zip(acc, keys)]
    fig_, ax = plt.subplots(figsize=(7.2, 3.8))
    x = range(len(keys)); w = 0.36
    b1 = ax.bar([i - w / 2 for i in x], acc, w, yerr=[lo, hi], capsize=3, color="#2563eb", label="Acurácia (IC 95%)", error_kw=dict(lw=0.8, ecolor="#374151"))
    b2 = ax.bar([i + w / 2 for i in x], f1, w, color="#93c5fd", label="F1 macro (×100)")
    for b in list(b1) + list(b2):
        ax.text(b.get_x() + b.get_width() / 2, 2, f"{b.get_height():.0f}".replace(".", ","), ha="center", fontsize=8, color="white" if b in b1 else "#1e3a8a", fontweight="bold")
    for y, lab, ls in ((33.3, "Acaso (33%)", ":"), (60, "Pessoas – OCDE (60%)", "--"), (70, "Ghadiri et al. (70%)", "-.")):
        ax.axhline(y, color="#6b7280", lw=0.9, ls=ls); ax.text(3.62, y + 0.8, lab, fontsize=7, color="#374151", ha="right")
    ax.set_xticks(list(x)); ax.set_xticklabels(names, fontsize=8.5); ax.set_ylim(0, 100); ax.set_ylabel("%", fontsize=9)
    ax.spines[["top", "right"]].set_visible(False); ax.legend(fontsize=8, loc="upper left", frameon=False)
    ax.tick_params(labelsize=8)
    D["fig_variantes"] = os.path.join(S, "fig", "fig_variantes.png")
    fig_.savefig(D["fig_variantes"], dpi=300, bbox_inches="tight", facecolor="white"); plt.close(fig_)

# ------------------------------------------------------------------ apêndices
def prompt_text(name):
    return open(os.path.join(REPO, "packages/core/src/prompts", f"{name}.md")).read()
prompts = [(f"A.{i} {title}", prompt_text(n)) for i, (n, title) in enumerate((
    ("claim-extraction", "Extração de afirmações (versão 2)"), ("query-generation", "Geração de consultas"),
    ("verification", "Verificação de afirmação"), ("article-verification", "Variante sem decomposição"),
    ("no-retrieval", "Variante sem recuperação")), start=1)]
mapeamento = []
for line in open(os.path.join(REPO, "eval/dataset/mapeamento_rotulos.md")):
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if line.startswith("|") and len(cells) == 4 and cells[0] not in ("Agência", "") and not set(cells[0]) <= set("- "):
        mapeamento.append([cells[0], cells[1], cells[2].replace("**", "")])

TX = T(R, D) if callable(T) else T


def build(meta):
    m = abnt.Monografia()
    content_a.capa(m); m.new_section_after_cover(); content_a.folha_rosto(m); content_a.banca(m)
    content_a.resumo(m, TX)
    content_a.listas(m, meta)
    m.new_section_numbered()
    content_a.cap1(m, TX); content_a.cap2(m, TX); content_a.cap3(m, TX, img)
    content_b.cap4(m, TX, fig, tela)
    content_c.cap5(m, R, D, TX); content_c.cap6(m, R, D, TX)
    content_refs.referencias(m)
    content_c.apendices(m, prompts, mapeamento)
    return m


m1 = build({})
meta = {"headings": [(l, t) for l, t in m1.headings], **m1.captions}
m2 = build(meta)
m2.save(OUT)
print("ok", OUT, "| figuras", m2.n_fig, "quadros", m2.n_quadro, "tabelas", m2.n_tab, "equações", m2.n_eq)
for k, v in m2.captions.items():
    for n, t in v:
        print(f"  {k} {n}: {t}")
