"""Lê eval/runs e calcula tudo o que o Capítulo 5 usa (sem chamar APIs)."""
import glob, json, math, os, statistics as st
from collections import Counter

LABELS = ["VERDADEIRO", "FALSO", "IMPRECISO"]
FACTCHECK = ["agencialupa.org", "lupa.uol.com.br", "piaui.folha.uol.com.br", "aosfatos.org",
             "estadao.com.br/estadao-verifica", "noticias.uol.com.br/confere", "checamos.afp.com",
             "projetocomprova.com.br", "g1.globo.com/fato-ou-fake", "boatos.org", "e-farsas.com"]


def is_factcheck(url):
    u = url.lower().split("://", 1)[-1]
    u = u[4:] if u.startswith("www.") else u
    return any(u.startswith(d) or ("." + d) in ("." + u.split("/")[0]) and "/" not in d for d in FACTCHECK)


def load_run(d):
    cfg = json.load(open(os.path.join(d, "config.json")))
    recs = [json.loads(l) for l in open(os.path.join(d, "results.jsonl"))]
    metrics = json.load(open(os.path.join(d, "metrics.json"))) if os.path.exists(os.path.join(d, "metrics.json")) else None
    costs = json.load(open(os.path.join(d, "costs.json"))) if os.path.exists(os.path.join(d, "costs.json")) else None
    return {"dir": d, "cfg": cfg, "recs": recs, "metrics": metrics, "costs": costs}


def find_runs(root):
    runs = {}
    for d in sorted(glob.glob(os.path.join(root, "eval/runs/*"))):
        if not os.path.exists(os.path.join(d, "results.jsonl")):
            continue
        r = load_run(d)
        key = (r["cfg"]["variant"], r["cfg"]["split"], r["cfg"]["promptVersions"].get("claim-extraction"))
        runs[key] = r  # o mais recente vence
    return runs


def classification(pairs):
    conf = {e: {p: 0 for p in LABELS} for e in LABELS}
    for e, p in pairs:
        conf[e][p] += 1
    n = len(pairs)
    per = {}
    for k in LABELS:
        tp = conf[k][k]; pred = sum(conf[e][k] for e in LABELS); sup = sum(conf[k].values())
        prec = tp / pred if pred else 0.0; rec = tp / sup if sup else 0.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
        per[k] = dict(precision=prec, recall=rec, f1=f1, support=sup, predicted=pred)
    acc = sum(conf[k][k] for k in LABELS) / n if n else 0
    return dict(n=n, accuracy=acc, macroF1=sum(per[k]["f1"] for k in LABELS) / 3, perClass=per, confusion=conf)


def mcnemar_exact(a_ok, b_ok):
    """a_ok/b_ok: dict id -> bool. Retorna b (A certo, B errado), c (B certo, A errado) e p bilateral exato."""
    ids = sorted(set(a_ok) & set(b_ok))
    b = sum(1 for i in ids if a_ok[i] and not b_ok[i])
    c = sum(1 for i in ids if b_ok[i] and not a_ok[i])
    n = b + c
    if n == 0:
        return dict(b=b, c=c, p=1.0, n=len(ids))
    k = min(b, c)
    p = sum(math.comb(n, i) for i in range(0, k + 1)) / 2 ** n * 2
    return dict(b=b, c=c, p=min(1.0, p), n=len(ids))


def wilson(k, n, z=1.96):
    if n == 0:
        return (0, 0)
    p = k / n; den = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / den
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return (centre - half, centre + half)


def summarize(run):
    recs = run["recs"]
    pairs = [(r["expected"], r["result"]["verdict"]) for r in recs]
    cls = classification(pairs)
    ok = {r["id"]: r["expected"] == r["result"]["verdict"] for r in recs}
    claims = [c for r in recs for c in r["result"]["claims"]]
    ev = [e for c in claims for e in c.get("evidences", [])]
    fc_ev = [e for e in ev if is_factcheck(e["url"])]
    # afirmações cuja decisão usou alguma evidência de agência
    used_fc = 0; decided = 0
    for r in recs:
        for c in r["result"]["claims"]:
            if c["label"] != "INSUFICIENTE":
                decided += 1
                ids = set(c.get("evidenceIdsUsed", []) or [])
                if any(e["id"] in ids and is_factcheck(e["url"]) for e in c.get("evidences", [])):
                    used_fc += 1
    items_with_fc = sum(1 for r in recs if any(is_factcheck(e["url"]) for c in r["result"]["claims"] for e in c.get("evidences", [])))
    tokens_in = sum(r["result"]["meta"]["tokens"]["input"] for r in recs)
    tokens_out = sum(r["result"]["meta"]["tokens"]["output"] for r in recs)
    calls = Counter()
    for r in recs:
        for k, v in (r["result"]["meta"].get("apiCalls") or {}).items():
            calls[k] += v
    lat = [r["result"]["meta"]["latencyMs"]["total"] for r in recs]
    n_claims = [len(r["result"]["claims"]) for r in recs]
    cov = [r["result"]["coverage"] for r in recs]
    lo, hi = wilson(sum(ok.values()), len(ok))
    by_class_claims = {k: Counter(c["label"] for r in recs if r["expected"] == k for c in r["result"]["claims"]) for k in LABELS}
    inversions = sum(1 for e, p in pairs if {e, p} == {"VERDADEIRO", "FALSO"})
    adjacent = sum(1 for e, p in pairs if e != p and {e, p} != {"VERDADEIRO", "FALSO"})
    bin_ok = sum(1 for e, p in pairs if (e == "VERDADEIRO") == (p == "VERDADEIRO"))
    low_cov = sum(1 for r in recs if r["result"]["coverage"] < 0.5 - 1e-9)
    impr_to_false_with_contra = sum(1 for r in recs if r["expected"] == "IMPRECISO" and r["result"]["verdict"] == "FALSO")
    return dict(
        inversions=inversions, adjacent=adjacent, bin_acc=bin_ok / len(pairs) if pairs else 0, low_cov=low_cov,
        impr_to_false=impr_to_false_with_contra,
        cls=cls, ok=ok, n=len(recs), acc_ci=(lo, hi),
        claims_total=len(claims), claims_mean=st.mean(n_claims) if n_claims else 0,
        claims_median=st.median(n_claims) if n_claims else 0,
        claim_labels=Counter(c["label"] for c in claims), by_class_claims=by_class_claims,
        evidences_total=len(ev), ev_per_claim=(len(ev) / len(claims)) if claims else 0,
        fc_share=(len(fc_ev) / len(ev)) if ev else 0, items_with_fc=items_with_fc,
        decided=decided, used_fc=used_fc,
        coverage_mean=st.mean(cov) if cov else 0,
        tokens_in=tokens_in, tokens_out=tokens_out, calls=dict(calls),
        lat_mean=st.mean(lat) if lat else 0, lat_p95=sorted(lat)[max(0, math.ceil(0.95 * len(lat)) - 1)] if lat else 0,
        costs=run["costs"], cfg=run["cfg"], recs=recs,
        domains=Counter(e["domain"] for e in ev).most_common(12),
    )


def load_all(root):
    runs = find_runs(root)
    out = {}
    for (variant, split, pv), run in runs.items():
        out[(variant, split, pv)] = summarize(run)
    return out


if __name__ == "__main__":
    import sys
    R = load_all(sys.argv[1])
    for k, v in R.items():
        c = v["cls"]
        print(k, "n=%d acc=%.3f mF1=%.3f IC95=(%.2f,%.2f)" % (v["n"], c["accuracy"], c["macroF1"], *v["acc_ci"]),
              "claims=%.1f fc_share=%.2f used_fc=%d/%d tok=%d/%d" % (v["claims_mean"], v["fc_share"], v["used_fc"], v["decided"], v["tokens_in"], v["tokens_out"]))
