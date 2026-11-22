"""Gera os diagramas do TCC II (PNG, 300 dpi) com matplotlib."""
import sys, os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Ellipse, FancyArrowPatch, Rectangle

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
plt.rcParams["font.family"] = "DejaVu Sans"

INK = "#1f2937"
BLUE = "#dbeafe"; BLUE_E = "#1d4ed8"
GREEN = "#dcfce7"; GREEN_E = "#15803d"
AMBER = "#fef3c7"; AMBER_E = "#b45309"
GRAY = "#f3f4f6"; GRAY_E = "#4b5563"
PURPLE = "#ede9fe"; PURPLE_E = "#6d28d9"


def box(ax, x, y, w, h, text, fc=BLUE, ec=BLUE_E, fs=9, bold=False, r=0.02):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0.005,rounding_size={r}",
                                fc=fc, ec=ec, lw=1.2))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs, color=INK,
            fontweight="bold" if bold else "normal", wrap=True)


def arrow(ax, x1, y1, x2, y2, text=None, fs=7.5, style="-|>", color=GRAY_E, ls="-", off=(0, 0.012)):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle=style, mutation_scale=11,
                                 color=color, lw=1.1, linestyle=ls, shrinkA=2, shrinkB=2))
    if text:
        ax.text((x1 + x2) / 2 + off[0], (y1 + y2) / 2 + off[1], text, ha="center", va="bottom",
                fontsize=fs, color=GRAY_E)


def canvas(w, h):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
    return fig, ax


def save(fig, name):
    fig.savefig(os.path.join(OUT, name), dpi=300, bbox_inches="tight", facecolor="white")
    plt.close(fig)


# 1. Arquitetura de componentes ------------------------------------------------
fig, ax = canvas(10, 6.4)
# camadas de entrada
ax.text(0.02, 0.965, "Interfaces (apps/ e eval/)", fontsize=9, fontweight="bold", color=GRAY_E)
box(ax, 0.02, 0.84, 0.28, 0.1, "apps/web\nReact + Vite (navegador)", GRAY, GRAY_E)
box(ax, 0.36, 0.84, 0.28, 0.1, "apps/api\nFastify: POST /verify,\nGET /verify/:id/stream (SSE)", GRAY, GRAY_E, fs=8)
box(ax, 0.70, 0.84, 0.28, 0.1, "eval/scripts\nrun · calibrate · metrics\nsample-claims · kappa", GRAY, GRAY_E, fs=8)
arrow(ax, 0.30, 0.89, 0.36, 0.89)
ax.text(0.33, 0.80, "HTTP/SSE", ha="center", fontsize=7.5, color=GRAY_E)
# core
ax.add_patch(Rectangle((0.02, 0.06), 0.96, 0.72, fc="#fafafa", ec=GRAY_E, lw=1, ls="--"))
ax.text(0.03, 0.755, "packages/core (pipeline puro, sem HTTP)", fontsize=9, fontweight="bold", color=GRAY_E)
box(ax, 0.30, 0.64, 0.40, 0.08, "VerificationPipeline (pipeline.ts)\norquestração + eventos de progresso", PURPLE, PURPLE_E, fs=8.5)
arrow(ax, 0.50, 0.84, 0.50, 0.72)
arrow(ax, 0.84, 0.84, 0.62, 0.72)
# serviços
svc = ["Scraper", "Claim\nExtraction", "Query\nGeneration", "Search", "Evidence\n(BM25)", "Verification", "Scoring +\nExplicação"]
xs = [0.03 + i * 0.136 for i in range(7)]
for x, s in zip(xs, svc):
    box(ax, x, 0.46, 0.12, 0.1, s, BLUE, BLUE_E, fs=8)
    arrow(ax, 0.50, 0.64, x + 0.06, 0.56, color="#9ca3af")
ax.text(0.03, 0.575, "services/", fontsize=8, color=GRAY_E)
# clientes
ax.text(0.03, 0.355, "clients/ (interfaces injetadas)", fontsize=8, color=GRAY_E)
box(ax, 0.03, 0.23, 0.26, 0.11, "ReaderClient\nFallbackReader:\nJina → Readability", GREEN, GREEN_E, fs=8)
box(ax, 0.37, 0.23, 0.26, 0.11, "LlmClient\nCachedLlmClient → GeminiClient\n+ RateLimiter (RPM/RPD)", GREEN, GREEN_E, fs=8)
box(ax, 0.71, 0.23, 0.26, 0.11, "SearchClient\nSerperClient\n(gl=br, hl=pt-br)", GREEN, GREEN_E, fs=8)
arrow(ax, xs[0] + 0.06, 0.46, 0.13, 0.34)
arrow(ax, xs[4] + 0.06, 0.46, 0.20, 0.34)
for i in (1, 2, 5):
    arrow(ax, xs[i] + 0.06, 0.46, 0.50, 0.34)
arrow(ax, xs[3] + 0.06, 0.46, 0.80, 0.34)
# infra
box(ax, 0.06, 0.08, 0.26, 0.09, "CacheStore (SQLite)\nverification_cache · llm_cache", AMBER, AMBER_E, fs=8)
box(ax, 0.37, 0.08, 0.26, 0.09, "prompts/*.md\nid + version (front-matter)", AMBER, AMBER_E, fs=8)
box(ax, 0.68, 0.08, 0.26, 0.09, "config.ts\nlimiares · domínios · flags", AMBER, AMBER_E, fs=8)
arrow(ax, 0.45, 0.23, 0.25, 0.17, ls="--")
arrow(ax, 0.50, 0.23, 0.50, 0.17, ls="--")
# externos
for x, t in [(0.03, "r.jina.ai /\nsites de notícias"), (0.37, "Google Gemini API"), (0.71, "Serper.dev (Google)")]:
    ax.text(x + 0.13, 0.0, t, ha="center", va="bottom", fontsize=7.5, color=GRAY_E, style="italic")
save(fig, "fig_arquitetura.png")

# 2. Fluxo do pipeline ---------------------------------------------------------
fig, ax = canvas(10, 4.6)
steps = [
    ("Entrada", "URL ou texto", GRAY, GRAY_E),
    ("1 Scraper", "Jina Reader →\nReadability\n(≤ 20.000 car.)", BLUE, BLUE_E),
    ("2 Claim\nExtraction", "LLM → JSON\n(Zod), ≤ 10\nafirmações", BLUE, BLUE_E),
    ("3 Query\nGeneration", "LLM: 1 consulta\npor afirmação\n(1 chamada)", BLUE, BLUE_E),
]
x = 0.01
for title, sub, fc, ec in steps:
    box(ax, x, 0.62, 0.18, 0.3, f"{title}\n\n{sub}", fc, ec, fs=8)
    if x > 0.02:
        arrow(ax, x - 0.065, 0.77, x, 0.77)
    x += 0.245
# loop por afirmação
ax.add_patch(Rectangle((0.08, 0.05), 0.70, 0.46, fc="#f8fafc", ec=PURPLE_E, lw=1.1, ls="--"))
ax.text(0.09, 0.47, "para cada afirmação (até 3 em paralelo)", fontsize=8, color=PURPLE_E, fontweight="bold")
inner = [
    ("4 Search", "Serper top-5\nexclui domínio\nda origem"),
    ("5 Evidence", "lê ≤ 3 páginas\nBM25 → ≤ 3\ntrechos/página"),
    ("6 Verification", "LLM, temp. 0:\nSUPORTADA /\nCONTRADITA /\nINSUFICIENTE"),
]
x = 0.10
for title, sub in inner:
    box(ax, x, 0.09, 0.19, 0.33, f"{title}\n\n{sub}", PURPLE, PURPLE_E, fs=8)
    if x > 0.11:
        arrow(ax, x - 0.04, 0.255, x, 0.255)
    x += 0.23
arrow(ax, 0.80, 0.62, 0.20, 0.51)
box(ax, 0.81, 0.09, 0.18, 0.33, "7 Scoring\n\ns = (n_s − n_c)/(n_s + n_c)\nc = (n_s + n_c)/N\n→ VERDADEIRO /\nFALSO / IMPRECISO", GREEN, GREEN_E, fs=6.8)
arrow(ax, 0.75, 0.255, 0.81, 0.255)
save(fig, "fig_pipeline.png")

# 3. Casos de uso --------------------------------------------------------------
fig, ax = canvas(10, 6.2)


def actor(ax, x, y, name):
    ax.add_patch(plt.Circle((x, y + 0.075), 0.017, fc="white", ec=INK, lw=1.2))
    ax.plot([x, x], [y + 0.058, y - 0.005], color=INK, lw=1.2)
    ax.plot([x - 0.025, x + 0.025], [y + 0.035, y + 0.035], color=INK, lw=1.2)
    ax.plot([x, x - 0.02], [y - 0.005, y - 0.05], color=INK, lw=1.2)
    ax.plot([x, x + 0.02], [y - 0.005, y - 0.05], color=INK, lw=1.2)
    ax.text(x, y - 0.06, name, ha="center", va="top", fontsize=8.5)


def uc(ax, x, y, text, w=0.25, h=0.075):
    ax.add_patch(Ellipse((x, y), w, h, fc=BLUE, ec=BLUE_E, lw=1.1))
    ax.text(x, y, text, ha="center", va="center", fontsize=7.8)


ax.add_patch(Rectangle((0.16, 0.03), 0.62, 0.94, fc="white", ec=INK, lw=1))
ax.text(0.47, 0.94, "Sistema VeritasAI", ha="center", fontsize=9.5, fontweight="bold")
actor(ax, 0.07, 0.68, "Usuário\n(cidadão)")
actor(ax, 0.07, 0.22, "Pesquisador")
user_ucs = [(0.40, 0.86, "UC01 Verificar notícia por URL"), (0.40, 0.765, "UC02 Verificar texto colado"),
            (0.40, 0.67, "UC03 Acompanhar progresso"), (0.40, 0.575, "UC04 Consultar veredito,\nafirmações e evidências"),
            (0.40, 0.48, "UC05 Consultar \"Como funciona\"")]
for x, y, t in user_ucs:
    uc(ax, x, y, t)
    ax.plot([0.095, x - 0.125], [0.70, y], color=GRAY_E, lw=0.9)
res_ucs = [(0.40, 0.37, "UC06 Executar variante\nsobre o dataset"), (0.40, 0.275, "UC07 Calibrar limiares"),
           (0.40, 0.18, "UC08 Calcular métricas"), (0.40, 0.085, "UC09 Sortear afirmações\ne calcular Kappa")]
for x, y, t in res_ucs:
    uc(ax, x, y, t)
    ax.plot([0.095, x - 0.125], [0.24, y], color=GRAY_E, lw=0.9)
# include
uc(ax, 0.66, 0.67, "UC10 Executar pipeline\nde verificação", w=0.22)
for y in (0.86, 0.765, 0.37):
    arrow(ax, 0.525, y, 0.555, 0.67, ls="--", color="#6b7280")
ax.text(0.585, 0.80, "«include»", fontsize=7, color="#6b7280", rotation=-35)
# sistemas externos
for y, t in [(0.82, "Google Gemini"), (0.67, "Serper.dev"), (0.52, "Jina Reader")]:
    ax.add_patch(Rectangle((0.84, y - 0.04), 0.14, 0.08, fc=GREEN, ec=GREEN_E))
    ax.text(0.91, y, f"«sistema»\n{t}", ha="center", va="center", fontsize=7.5)
    ax.plot([0.77, 0.84], [0.67, y], color=GRAY_E, lw=0.9)
save(fig, "fig_casos_uso.png")

# 4. Modelo de dados -----------------------------------------------------------
fig, ax = canvas(10, 5.6)


def entity(ax, x, y, w, title, fields, fc=AMBER, ec=AMBER_E):
    h = 0.055 * (len(fields) + 1)
    ax.add_patch(Rectangle((x, y - h), w, h, fc="white", ec=ec, lw=1.2))
    ax.add_patch(Rectangle((x, y - 0.055), w, 0.055, fc=fc, ec=ec, lw=1.2))
    ax.text(x + w / 2, y - 0.0275, title, ha="center", va="center", fontsize=8.5, fontweight="bold")
    for i, f in enumerate(fields):
        ax.text(x + 0.01, y - 0.055 * (i + 1.5), f, va="center", fontsize=7.6, family="DejaVu Sans Mono")
    return h


ax.text(0.02, 0.97, "(a) Persistência: cache SQLite (sem dados de usuário)", fontsize=9, fontweight="bold")
entity(ax, 0.02, 0.92, 0.42, "verification_cache", ["PK url_hash     TEXT", "PK config_hash  TEXT",
       "   result_json  TEXT  (VerificationResult)", "   created_at   TEXT"])
entity(ax, 0.02, 0.55, 0.42, "llm_cache", ["PK prompt_hash  TEXT", "PK model        TEXT",
       "   response_json TEXT", "   created_at    TEXT"])
ax.text(0.02, 0.13, "model ∈ {gemini-…, serper, jina, readability}:\nguarda também buscas e páginas lidas,\ncongelando a entrada de cada experimento.", fontsize=7.5, color=GRAY_E)
ax.text(0.52, 0.97, "(b) Modelo de domínio (schemas Zod)", fontsize=9, fontweight="bold")
entity(ax, 0.52, 0.92, 0.22, "VerificationResult", ["article: Article", "claims: ClaimResult[]", "score: number|null",
       "coverage: number", "verdict: NewsVerdict", "explanation", "meta: RunMeta"], BLUE, BLUE_E)
entity(ax, 0.78, 0.92, 0.21, "ClaimResult", ["claim: Claim", "query: string", "evidences: Evidence[]",
       "label: ClaimLabel", "rationale: string"], BLUE, BLUE_E)
entity(ax, 0.78, 0.50, 0.21, "Evidence", ["id (E1, E2…)", "url · domain", "title · snippet", "publishedAt?"], BLUE, BLUE_E)
entity(ax, 0.52, 0.42, 0.22, "Article", ["url · domain", "title? · publishedAt?", "text"], BLUE, BLUE_E)
arrow(ax, 0.74, 0.80, 0.78, 0.80, "1..N", off=(0, 0.005))
arrow(ax, 0.885, 0.59, 0.885, 0.50, "0..N", off=(0.03, -0.01))
arrow(ax, 0.63, 0.48, 0.63, 0.42, "1", off=(0.015, -0.01))
ax.text(0.52, 0.12, "ClaimLabel = SUPORTADA | CONTRADITA | INSUFICIENTE\nNewsVerdict = VERDADEIRO | FALSO | IMPRECISO", fontsize=7.6, family="DejaVu Sans Mono")
arrow(ax, 0.44, 0.83, 0.52, 0.83, "result_json", ls="--", off=(0, 0.005))
save(fig, "fig_modelo_dados.png")

# 5. Regiões de decisão do scoring --------------------------------------------
def scoring_fig(name, cmin=0.5, tmin=0.5, fmax=-0.3, title=None):
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    ax.set_xlim(0, 1); ax.set_ylim(-1, 1)
    ax.add_patch(Rectangle((0, -1), cmin, 2, fc="#e5e7eb"))
    ax.add_patch(Rectangle((cmin, tmin), 1 - cmin, 1 - tmin, fc="#bbf7d0"))
    ax.add_patch(Rectangle((cmin, -1), 1 - cmin, fmax + 1, fc="#fecaca"))
    ax.add_patch(Rectangle((cmin, fmax), 1 - cmin, tmin - fmax, fc="#fde68a"))
    ax.text(cmin / 2, 0, "IMPRECISO\n(cobertura\ninsuficiente)", ha="center", va="center", fontsize=9)
    ax.text((1 + cmin) / 2, (1 + tmin) / 2, "VERDADEIRO", ha="center", va="center", fontsize=10, fontweight="bold", color=GREEN_E)
    ax.text((1 + cmin) / 2, (fmax - 1) / 2, "FALSO", ha="center", va="center", fontsize=10, fontweight="bold", color="#b91c1c")
    ax.text((1 + cmin) / 2, (tmin + fmax) / 2, "IMPRECISO", ha="center", va="center", fontsize=9.5, color=AMBER_E)
    ax.axvline(cmin, color=INK, lw=1, ls="--"); ax.axhline(tmin, xmin=cmin, color=INK, lw=1, ls="--")
    ax.axhline(fmax, xmin=cmin, color=INK, lw=1, ls="--")
    ax.set_xlabel("cobertura c = (n_s + n_c) / N   (0,5 = 50% das afirmações com evidência)", fontsize=8.5)
    ax.set_ylabel("score s = (n_s − n_c) / (n_s + n_c)", fontsize=8.5)
    ax.set_xticks([0, 0.25, cmin, 0.75, 1]); ax.set_yticks([-1, fmax, 0, tmin, 1])
    ax.tick_params(labelsize=8)
    if title:
        ax.set_title(title, fontsize=9)
    fig.savefig(os.path.join(OUT, name), dpi=300, bbox_inches="tight", facecolor="white")
    plt.close(fig)


scoring_fig("fig_scoring.png")
if len(sys.argv) > 4:
    scoring_fig("fig_scoring_calibrado.png", float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]))
print(sorted(os.listdir(OUT)))
