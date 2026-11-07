"""
Step 3 — Analysis and visualisation.

Works on the cleaned file and answers the question the product exists for: which
companies in Marrakech are worth contacting first, and how do we reach them. The
opportunity score here is the same formula the platform uses, so the slides and the
app never disagree.

    python analysis/03_analyze.py
"""
import json
import math

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from common import (ACCENT, ACCENT_SOFT, BAD, CLEAN_CSV, GOOD, GRID, INK, MUTED,
                    NEUTRAL, OUT, RAMP, WARN, bar_labels, save, setup)

# Same weights as the platform's fit score (client/src/lib/scoring.js).
WEIGHTS = {"fit": 30, "pain": 30, "reach": 15, "volume": 25}
TIERS = {
    "Hôtellerie": 1.0, "Restauration": 1.0, "Immobilier": 1.0, "Voyage & tourisme": 1.0, "Santé": 1.0,
    "Digital & marketing": 0.65, "Informatique & IT": 0.65, "Intelligence artificielle": 0.65,
    "E-commerce & livraison": 0.65, "Formation": 0.65, "Consultant": 0.65,
    "Commerce": 0.15, "Autre": 0.35,
}


def opportunity_score(row):
    """0-100. High when the sector is valuable, the digital presence weak and the
    company reachable and busy."""
    fit = TIERS.get(row["secteur"], 0.5)
    pain = 1.0 if not row["has_website"] else 0.15
    reach = 1.0 if row["mobile"] else (0.5 if pd.notna(row["telephone"]) else 0.0)
    volume = min(1.0, math.log10(row["nombre_avis"] + 1) / math.log10(101))
    total = sum(WEIGHTS.values())
    return round(100 * (WEIGHTS["fit"] * fit + WEIGHTS["pain"] * pain +
                        WEIGHTS["reach"] * reach + WEIGHTS["volume"] * volume) / total)


def main():
    setup()
    df = pd.read_csv(CLEAN_CSV, encoding="utf-8-sig")
    n = len(df)
    df["score"] = df.apply(opportunity_score, axis=1)
    out = {"rows": n}

    print(f"Analysing {n} cleaned companies\n")

    # ---------- 1. reachability funnel: can we contact them at all? ----------
    funnel = [
        ("Entreprises collectées", n),
        ("Avec un téléphone", int(df["telephone"].notna().sum())),
        ("Joignables par WhatsApp", int(df["mobile"].sum())),
        ("Avec un site web", int(df["has_website"].sum())),
        ("Avec un email", int(df["has_email"].sum())),
    ]
    out["funnel"] = dict(funnel)
    print("Reachability")
    for label, value in funnel:
        print(f"  {label:<26} {value:>4}  ({value / n:.0%})")

    fig, ax = plt.subplots(figsize=(7.6, 3.9))
    labels = [f[0] for f in funnel][::-1]
    values = [f[1] for f in funnel][::-1]
    bars = ax.barh(labels, values, color=RAMP[::-1], height=0.64)
    for bar, v in zip(bars, values):
        ax.text(v + 4, bar.get_y() + bar.get_height() / 2, f"{v}  ({v / n:.0%})",
                va="center", fontsize=11, color=MUTED)
    ax.set_xlim(0, n * 1.22)
    ax.set_title("Un prospect sur deux n'a pas d'email")
    ax.xaxis.grid(True); ax.set_axisbelow(True)
    save(fig, "06_funnel")

    # ---------- 2. the digital gap, by sector ----------
    by_sector = (df.groupby("secteur")
                   .agg(total=("place_id", "size"),
                        sans_site=("has_website", lambda s: int((~s).sum())),
                        note=("note_ajustee", "mean"),
                        avis=("nombre_avis", "median"),
                        score=("score", "mean"))
                   .sort_values("total", ascending=False))
    by_sector["part_sans_site"] = by_sector["sans_site"] / by_sector["total"]
    out["sectors"] = by_sector.round(2).to_dict("index")
    print("\nTop sectors")
    print(by_sector.head(8).round(2).to_string())

    top = by_sector.head(8)[::-1]
    fig, ax = plt.subplots(figsize=(7.6, 4.2))
    with_site = top["total"] - top["sans_site"]
    ax.barh(top.index, with_site, color=NEUTRAL, height=0.62, label="a un site")
    ax.barh(top.index, top["sans_site"], left=with_site, color=ACCENT, height=0.62, label="sans site")
    for i, (_, row) in enumerate(top.iterrows()):
        ax.text(row["total"] + 1.5, i, f"{row['part_sans_site']:.0%} sans site",
                va="center", fontsize=10.5, color=MUTED)
    ax.set_xlim(0, top["total"].max() * 1.42)
    ax.set_title("Le déficit de présence en ligne, par secteur")
    ax.legend(frameon=False, fontsize=11, labelcolor=MUTED, loc="lower right")
    ax.xaxis.grid(True); ax.set_axisbelow(True)
    save(fig, "07_digital_gap")

    # ---------- 3. popularity is log-normal: a few giants, a long tail ----------
    avis = df["nombre_avis"]
    out["reviews"] = {"median": int(avis.median()), "mean": round(float(avis.mean()), 1),
                      "p90": int(avis.quantile(.9)), "max": int(avis.max()),
                      "share_under_50": round(float((avis < 50).mean()), 3)}
    print(f"\nReviews: median {avis.median():.0f}, mean {avis.mean():.1f}, "
          f"90th pct {avis.quantile(.9):.0f}, max {avis.max()}")

    fig, ax = plt.subplots(figsize=(7.4, 3.6))
    bins = np.logspace(0, math.log10(max(avis.max(), 10)), 24)
    ax.hist(avis + 1, bins=bins, color=ACCENT, edgecolor="white", linewidth=1.1)
    ax.set_xscale("log")
    ax.axvline(avis.median() + 1, color=INK, linestyle="--", linewidth=1.4)
    ax.text(avis.median() + 2, ax.get_ylim()[1] * .9, f" médiane {avis.median():.0f} avis",
            fontsize=11, color=INK)
    ax.set_xlabel("nombre d'avis (échelle log)"); ax.set_ylabel("entreprises")
    ax.set_title(f"{(avis < 50).mean():.0%} des entreprises ont moins de 50 avis")
    ax.yaxis.grid(True); ax.set_axisbelow(True)
    save(fig, "08_reviews_distribution")

    # ---------- 4. where the opportunity score lands ----------
    bands = pd.cut(df["score"], [0, 45, 65, 100], labels=["faible", "moyen", "élevé"])
    counts = bands.value_counts().reindex(["faible", "moyen", "élevé"])
    out["score"] = {"mean": round(float(df["score"].mean()), 1),
                    "bands": {str(k): int(v) for k, v in counts.items()},
                    "top10": df.nlargest(10, "score")[["nom", "secteur", "score"]].to_dict("records")}
    print(f"\nOpportunity score: mean {df['score'].mean():.1f}; "
          f"{counts['élevé']} companies score 65+")

    fig, ax = plt.subplots(figsize=(7.4, 3.6))
    ax.hist(df["score"], bins=20, color=ACCENT, edgecolor="white", linewidth=1.1)
    ax.axvline(65, color=GOOD, linestyle="--", linewidth=1.6)
    ax.text(66, ax.get_ylim()[1] * .88, f" {counts['élevé']} prospects prioritaires (65+)",
            fontsize=11, color=GOOD)
    ax.set_xlabel("score d'opportunité"); ax.set_ylabel("entreprises")
    ax.set_title("Répartition du score d'opportunité")
    ax.yaxis.grid(True); ax.set_axisbelow(True)
    save(fig, "09_score_distribution")

    # ---------- 5. the map: where they are ----------
    geo = df.dropna(subset=["latitude", "longitude"])
    fig, ax = plt.subplots(figsize=(6.6, 5.4))
    sizes = 14 + 60 * (geo["nombre_avis"] / geo["nombre_avis"].max()) ** 0.4
    scat = ax.scatter(geo["longitude"], geo["latitude"], s=sizes, c=geo["score"],
                      cmap="Blues", vmin=20, vmax=100, alpha=.85, edgecolors="white", linewidths=.6)
    ax.set_title("282 entreprises à Marrakech")
    ax.set_xlabel("longitude"); ax.set_ylabel("latitude")
    ax.set_aspect(1.17)
    cb = fig.colorbar(scat, ax=ax, shrink=.72, pad=.02)
    cb.set_label("score d'opportunité", color=MUTED, fontsize=11)
    cb.outline.set_visible(False)
    ax.grid(True, alpha=.6); ax.set_axisbelow(True)
    save(fig, "10_map")

    # ---------- 6. does a better rating come with more reviews? ----------
    rated = df.dropna(subset=["note"])
    corr = float(np.corrcoef(np.log10(rated["nombre_avis"] + 1), rated["note"])[0, 1])
    out["correlation_reviews_rating"] = round(corr, 3)
    print(f"Correlation between log(reviews) and rating: {corr:+.3f}")

    OUT.mkdir(exist_ok=True)
    (OUT / "analysis.json").write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str),
                                       encoding="utf-8")
    df.to_csv(OUT / "companies_scored.csv", index=False, encoding="utf-8-sig")
    print(f"\nReport -> outputs/analysis.json")
    print(f"Scored  -> outputs/companies_scored.csv")


if __name__ == "__main__":
    main()
