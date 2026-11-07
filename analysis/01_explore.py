"""
Step 1 — Data exploration.

Reads the raw collected file and answers: what is in it, what is missing, what is
inconsistent. It changes nothing; it only measures and reports, so that step 2 fixes
problems we have actually seen rather than ones we assume.

    python analysis/01_explore.py
"""
import json
import re
from urllib.parse import urlparse

import pandas as pd
import matplotlib.pyplot as plt

from common import (ACCENT, ACCENT_SOFT, BAD, CLEAN_CSV, FIG, GOOD, INK, MUTED, NEUTRAL,
                    OUT, RAMP, RAW_CSV, WARN, bar_labels, save, setup)

# Marrakech and its immediate outskirts. Anything outside this box was mis-geocoded.
BOX = {"lat": (31.50, 31.75), "lon": (-8.15, -7.85)}
PHONE_OK = re.compile(r"^0[5-7] \d\d \d\d \d\d \d\d$")
EMAIL_OK = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def load_raw():
    # utf-8-sig: the export carries a BOM, which would otherwise end up inside the
    # first column name and make `place_id` unreachable.
    return pd.read_csv(RAW_CSV, encoding="utf-8-sig", dtype=str)


def main():
    setup()
    df = load_raw()
    rows, cols = df.shape
    print(f"Raw dataset: {rows} rows x {cols} columns\n")

    report = {"rows": rows, "columns": list(df.columns)}

    # ---------- completeness ----------
    missing = df.isna().sum()
    report["missing"] = {c: int(missing[c]) for c in df.columns}
    print("Missing values")
    for col in df.columns:
        n = int(missing[col])
        if n:
            print(f"  {col:<13} {n:>4}  ({n / rows:.0%})")

    # ---------- duplicates ----------
    norm_name = df["nom"].str.lower().str.replace(r"[^a-z0-9]", "", regex=True)
    dup = {
        "exact_rows": int(df.duplicated().sum()),
        "place_id": int(df.duplicated(subset=["place_id"]).sum()),
        "normalised_name": int(norm_name.duplicated().sum()),
    }
    report["duplicates"] = dup
    print(f"\nDuplicates: {dup['exact_rows']} identical rows, {dup['place_id']} repeated "
          f"place_id, {dup['normalised_name']} repeated name once punctuation and case are ignored")

    # ---------- numeric columns ----------
    note = pd.to_numeric(df["note"], errors="coerce")
    avis = pd.to_numeric(df["nombre_avis"], errors="coerce")
    thin = int(((note >= 5) & (avis <= 3)).sum())
    report["rating"] = {
        "missing": int(note.isna().sum()),
        "mean": round(float(note.mean()), 2),
        "median": float(note.median()),
        "perfect_but_thin": thin,
    }
    report["reviews"] = {
        "missing": int(avis.isna().sum()),
        "median": float(avis.median()),
        "max": int(avis.max()),
        "total": int(avis.sum()),
    }
    print(f"\nRating   mean {note.mean():.2f}, median {note.median():.1f} — "
          f"{thin} companies score a perfect 5.0 on 3 reviews or fewer")
    print(f"Reviews  median {avis.median():.0f}, max {avis.max():.0f}, "
          f"{avis.sum():.0f} in total")

    # ---------- phones ----------
    phone = df["telephone"].dropna()
    odd_phone = int((~phone.str.match(PHONE_OK)).sum())
    report["phone"] = {"present": int(phone.size), "non_standard_format": odd_phone}
    print(f"\nPhone    {phone.size} present, {odd_phone} not in the 0X XX XX XX XX format")

    # ---------- websites ----------
    site = df["site_web"].dropna()
    insecure = int(site.str.startswith("http://").sum())
    hosts = site.map(lambda u: (urlparse(u).hostname or "").lower())
    report["website"] = {
        "present": int(site.size),
        "missing": int(rows - site.size),
        "http_not_https": insecure,
        "distinct_hosts": int(hosts.nunique()),
    }
    print(f"Website  {site.size} present ({site.size / rows:.0%}), {insecure} still on http://")

    # ---------- emails ----------
    email = df["email"].dropna()
    malformed = int((~email.map(lambda x: bool(EMAIL_OK.match(x)))).sum())
    shared = email[email.duplicated(keep=False)]
    report["email"] = {
        "present": int(email.size),
        "missing": int(rows - email.size),
        "malformed": malformed,
        "shared_addresses": int(shared.nunique()),
    }
    print(f"Email    {email.size} present ({email.size / rows:.0%}), {malformed} malformed, "
          f"{shared.nunique()} address(es) used by more than one company")

    # ---------- categories ----------
    counts = df["categorie"].value_counts(dropna=False)
    biggest = counts.index[0] if pd.notna(counts.index[0]) else "(missing)"
    report["category"] = {
        "distinct": int(df["categorie"].nunique()),
        "missing": int(df["categorie"].isna().sum()),
        "largest": str(biggest),
        "largest_share": round(float(counts.iloc[0] / rows), 3),
    }
    print(f"\nCategory {df['categorie'].nunique()} distinct labels; '{biggest}' alone covers "
          f"{counts.iloc[0] / rows:.0%} of the file")

    # ---------- geography ----------
    lat = pd.to_numeric(df["latitude"], errors="coerce")
    lon = pd.to_numeric(df["longitude"], errors="coerce")
    outside = int(((lat < BOX["lat"][0]) | (lat > BOX["lat"][1]) |
                   (lon < BOX["lon"][0]) | (lon > BOX["lon"][1])).sum())
    report["geo"] = {"outside_marrakech": outside}
    print(f"Geo      {outside} company outside the Marrakech bounding box")

    # ---------- how the data was collected ----------
    report["collection"] = {
        "queries": int(df["query"].nunique()),
        "top": df["query"].value_counts().head(5).to_dict(),
    }
    print(f"\nCollected with {df['query'].nunique()} distinct Google Places search queries")

    # ---------- figures ----------
    print("\nWriting figures")

    # 1. where the gaps are
    gaps = missing[missing > 0].sort_values()
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    bars = ax.barh(gaps.index, gaps.values, color=[BAD if v > rows * 0.4 else WARN for v in gaps.values], height=0.62)
    bar_labels(ax, bars, pad=2, horizontal=True)
    ax.set_xlim(0, rows)
    ax.set_title(f"Missing values by column (out of {rows} companies)")
    ax.xaxis.grid(True); ax.set_axisbelow(True)
    save(fig, "01_missing")

    # 2. the category imbalance that makes segmentation hard
    top = df["categorie"].fillna("(not given)").value_counts().head(8)[::-1]
    fig, ax = plt.subplots(figsize=(7.2, 3.8))
    colors = [ACCENT if v < counts.iloc[0] else BAD for v in top.values]
    bars = ax.barh(top.index, top.values, color=colors, height=0.62)
    bar_labels(ax, bars, pad=2, horizontal=True)
    ax.set_xlim(0, counts.iloc[0] * 1.15)
    ax.set_title("One label swallows half the dataset")
    ax.xaxis.grid(True); ax.set_axisbelow(True)
    save(fig, "02_categories_raw")

    # 3. ratings: the mean hides how many are unproven
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    ax.hist(note.dropna(), bins=16, color=ACCENT, edgecolor="white", linewidth=1.2)
    ax.hist(note[(note >= 5) & (avis <= 3)], bins=16, color=BAD, edgecolor="white", linewidth=1.2,
            label=f"5.0 from ≤3 reviews ({thin})")
    ax.axvline(note.mean(), color=INK, linestyle="--", linewidth=1.4)
    ax.text(note.mean() - 0.05, ax.get_ylim()[1] * 0.92, f"mean {note.mean():.2f}",
            ha="right", color=INK, fontsize=11)
    ax.set_title("Google rating: a high average built on thin evidence")
    ax.set_xlabel("rating"); ax.set_ylabel("companies")
    ax.legend(frameon=False, fontsize=11, labelcolor=MUTED)
    ax.yaxis.grid(True); ax.set_axisbelow(True)
    save(fig, "03_ratings_raw")

    OUT.mkdir(exist_ok=True)
    (OUT / "exploration.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nReport -> {(OUT / 'exploration.json').relative_to(OUT.parent)}")


if __name__ == "__main__":
    main()
