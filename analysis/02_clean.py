"""
Step 2 — Cleaning and preparation.

Every fix below answers a problem step 1 measured. Each one records how many rows it
touched, so the cleaning can be audited instead of trusted.

    python analysis/02_clean.py
"""
import json
import re
from urllib.parse import urlparse, urlunparse

import pandas as pd
import matplotlib.pyplot as plt

from common import (ACCENT, BAD, CLEAN_CSV, GOOD, GRID, INK, MUTED, NEUTRAL, OUT,
                    RAW_CSV, WARN, bar_labels, save, setup)

BOX = {"lat": (31.50, 31.75), "lon": (-8.15, -7.85)}
EMAIL_OK = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")

# "Services" covers half the file, which is useless for segmenting. These keywords read
# the company name to recover what the business actually does.
TRADE_RULES = [
    ("Hôtellerie",      r"\b(hotel|hôtel|riad|resort|hostel|auberge|maison d.?h[oô]te|guest ?house)\b"),
    ("Restauration",    r"\b(restaurant|caf[ée]|lounge|traiteur|pizz|snack)\b"),
    ("Immobilier",      r"\b(immobili|real ?estate|promotion immo|agence immo)\b"),
    ("Voyage & tourisme", r"\b(voyage|travel|tour(s|isme)?|excursion|transfert)\b"),
    ("Digital & marketing", r"\b(digital|marketing|communication|web|seo|agence de com|media|créa)\b"),
    ("Informatique & IT", r"\b(informatique|software|it\b|syst[èe]me|r[ée]seau|cloud|data|tech)\b"),
    ("Intelligence artificielle", r"\b(\.?ai\b|intelligence artificielle|artificial)\b"),
    ("E-commerce & livraison", r"\b(e-?commerce|livraison|logistic|delivery|colis)\b"),
    ("Santé",           r"\b(clinique|m[ée]dical|dentaire|pharma|sant[ée]|kin[ée])\b"),
    ("Formation",       r"\b(formation|[ée]cole|academy|acad[ée]mie|institut|centre de form|coaching)\b"),
    ("Commerce",        r"\b(magasin|boutique|store|shop|[ée]lectronique)\b"),
]


def normalise_phone(value):
    """Moroccan numbers arrive in half a dozen shapes. Return 0X XX XX XX XX, or None."""
    if not isinstance(value, str) or not value.strip():
        return None
    digits = re.sub(r"[^\d+]", "", value)
    for prefix, cut in (("+212", 4), ("00212", 5), ("212", 3)):
        if digits.startswith(prefix) and len(digits) >= cut + 9:
            digits = "0" + digits[cut:]
            break
    digits = re.sub(r"\D", "", digits)
    if len(digits) != 10 or not digits.startswith("0"):
        return None
    return f"{digits[:2]} {digits[2:4]} {digits[4:6]} {digits[6:8]} {digits[8:]}"


def normalise_url(value):
    """Lowercase the host, drop a trailing slash, prefer https. Returns None if unusable."""
    if not isinstance(value, str) or not value.strip():
        return None
    url = value.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        parsed = urlparse(url)
    except ValueError:
        return None
    if not parsed.hostname:
        return None
    host = parsed.hostname.lower()
    path = parsed.path.rstrip("/")
    return urlunparse(("https", host, path, "", "", ""))


# Google's own labels, folded onto the same vocabulary as the rules above so that
# "Hôtel" and "Hôtellerie" do not end up as two different sectors.
CATEGORY_MAP = {
    "Hôtel": "Hôtellerie", "Maison d'hôtes": "Hôtellerie", "Chambre d'hôtes": "Hôtellerie",
    "Complexe hôtelier": "Hôtellerie", "Hostel": "Hôtellerie", "Auberge": "Hôtellerie",
    "Restaurant": "Restauration",
    "Agence immobilière": "Immobilier",
    "Agence de voyages": "Voyage & tourisme",
    "Magasin d'électronique": "Commerce", "Magasin": "Commerce",
    "Service de livraison": "E-commerce & livraison",
    "Entreprise de télécommunications": "Informatique & IT",
    "Crèche": "Formation", "Établissement d'enseignement": "Formation", "Université": "Formation",
    "Santé": "Santé",
    "Consultant": "Conseil",
    "Fabricant": "Industrie",
    "Espace de coworking": "Services professionnels", "Siège social": "Services professionnels",
}


def sector_for(name, given):
    """
    Decide the business sector.

    Google's label wins whenever it says something specific. It is only when the label
    is missing or the catch-all "Services" — half the file — that we read the company
    name instead.
    """
    label = given.strip() if isinstance(given, str) else ""   # a missing label arrives as NaN
    if label and label != "Services":
        return CATEGORY_MAP.get(label, label)
    text = (name or "").lower()
    for sector, pattern in TRADE_RULES:
        if re.search(pattern, text):
            return sector
    return "Autre"


def bayesian_rating(note, avis, prior_mean, prior_weight=12):
    """
    A 5.0 from 2 reviews is not better than a 4.6 from 900. Pull every score towards the
    dataset mean in proportion to how little evidence backs it (m-estimate).
    """
    if pd.isna(note):
        return None
    n = 0 if pd.isna(avis) else float(avis)
    return round((n * float(note) + prior_weight * prior_mean) / (n + prior_weight), 2)


def main():
    setup()
    df = pd.read_csv(RAW_CSV, encoding="utf-8-sig", dtype=str)
    before = len(df)
    log = {"rows_in": before, "steps": []}

    def record(step, affected, detail=""):
        log["steps"].append({"step": step, "rows_affected": int(affected), "detail": detail})
        print(f"  {step:<34} {affected:>4}  {detail}")

    print(f"Cleaning {before} rows\n")

    # 1. whitespace and empty strings that read as values
    text_cols = df.columns
    squeezed = 0
    for col in text_cols:
        original = df[col]
        cleaned = original.str.strip().replace({"": None, "nan": None, "None": None})
        squeezed += int((original.fillna("�") != cleaned.fillna("�")).sum())
        df[col] = cleaned
    record("trimmed whitespace / empties", squeezed)

    # 2. duplicates: same place twice, or the same name under different punctuation
    df = df.drop_duplicates(subset=["place_id"])
    key = df["nom"].str.lower().str.replace(r"[^a-z0-9]", "", regex=True)
    dup_names = int(key.duplicated().sum())
    df = df[~key.duplicated()].copy()
    record("dropped duplicate companies", before - len(df), f"{dup_names} matched on normalised name")

    # 3. phone numbers to one format
    fixed_phone = df["telephone"].map(normalise_phone)
    changed = int((fixed_phone.fillna("") != df["telephone"].fillna("")).sum())
    unusable = int(df["telephone"].notna().sum() - fixed_phone.notna().sum())
    df["telephone"] = fixed_phone
    record("standardised phone numbers", changed, f"{unusable} could not be parsed")

    # mobile vs landline decides whether WhatsApp is possible at all
    df["mobile"] = df["telephone"].fillna("").str.replace(" ", "").str.match(r"^0[67]\d{8}$")
    record("flagged mobile numbers", int(df["mobile"].sum()), "WhatsApp reachable")

    # 4. websites to one shape
    fixed_url = df["site_web"].map(normalise_url)
    changed = int((fixed_url.fillna("") != df["site_web"].fillna("")).sum())
    df["site_web"] = fixed_url
    df["has_website"] = df["site_web"].notna()
    record("normalised website URLs", changed, "https, lowercase host, no trailing slash")

    # 5. emails: drop anything that is not an address, flag shared ones
    bad_email = df["email"].notna() & ~df["email"].fillna("").str.match(EMAIL_OK)
    df.loc[bad_email, "email"] = None
    df["email"] = df["email"].str.lower()
    shared = df["email"].dropna()
    shared = set(shared[shared.duplicated(keep=False)])
    df["email_shared"] = df["email"].isin(shared) & df["email"].notna()
    df["has_email"] = df["email"].notna()
    record("validated email addresses", int(bad_email.sum()),
           f"{len(shared)} address(es) shared by several companies")

    # 6. numeric columns
    df["note"] = pd.to_numeric(df["note"], errors="coerce")
    df["nombre_avis"] = pd.to_numeric(df["nombre_avis"], errors="coerce")
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")

    # A company with no reviews has 0 reviews, not an unknown number. The rating stays
    # missing on purpose: there is genuinely no opinion to impute.
    no_reviews = int(df["nombre_avis"].isna().sum())
    df["nombre_avis"] = df["nombre_avis"].fillna(0).astype(int)
    df["unrated"] = df["note"].isna()
    record("reviews: missing means zero", no_reviews, "rating left missing, not invented")

    # 7. ratings weighted by how much evidence supports them
    prior = float(df["note"].mean())
    df["note_ajustee"] = [bayesian_rating(n, a, prior) for n, a in zip(df["note"], df["nombre_avis"])]
    inflated = int(((df["note"] >= 5) & (df["nombre_avis"] <= 3)).sum())
    record("weighted rating added", inflated, f"perfect-but-thin scores pulled toward {prior:.2f}")

    # 8. a trade that can actually be segmented
    df["secteur"] = [sector_for(n, c) for n, c in zip(df["nom"], df["categorie"])]
    recovered = int((df["categorie"].fillna("Services").eq("Services") & df["secteur"].ne("Autre")).sum())
    record("re-derived business sector", recovered, "from company names, 'Services' was 51%")

    # 9. geocoding outliers
    outside = ((df["latitude"] < BOX["lat"][0]) | (df["latitude"] > BOX["lat"][1]) |
               (df["longitude"] < BOX["lon"][0]) | (df["longitude"] > BOX["lon"][1]))
    df.loc[outside, ["latitude", "longitude"]] = None
    record("cleared out-of-area coordinates", int(outside.sum()), "outside the Marrakech box")

    # 10. a single contactability flag the product can act on
    df["joignable"] = df["has_email"] | df["telephone"].notna()
    record("contactability flag", int(df["joignable"].sum()), "has a phone or an email")

    order = ["place_id", "nom", "secteur", "categorie", "adresse", "telephone", "mobile",
             "email", "has_email", "email_shared", "site_web", "has_website", "note",
             "note_ajustee", "unrated", "nombre_avis", "latitude", "longitude",
             "joignable", "google_maps", "query"]
    df = df[order]

    OUT.mkdir(exist_ok=True)
    df.to_csv(CLEAN_CSV, index=False, encoding="utf-8-sig")
    log["rows_out"] = len(df)
    log["columns_out"] = list(df.columns)
    (OUT / "cleaning_report.json").write_text(json.dumps(log, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\n{before} rows in, {len(df)} rows out, {len(df.columns)} columns")
    print(f"Clean file -> {CLEAN_CSV.relative_to(OUT.parent)}")

    # before / after completeness, the headline of this step
    fields = ["telephone", "site_web", "email", "secteur"]
    raw = pd.read_csv(RAW_CSV, encoding="utf-8-sig", dtype=str)
    before_pct = [raw[f if f != "secteur" else "categorie"].notna().mean() * 100 for f in fields]
    after_pct = [df[f].notna().mean() * 100 for f in fields]
    labels = ["Téléphone", "Site web", "Email", "Secteur"]

    fig, ax = plt.subplots(figsize=(7.4, 3.8))
    y = range(len(labels))
    h = 0.36
    b1 = ax.barh([i + h / 2 for i in y], before_pct, height=h, color=NEUTRAL, label="avant")
    b2 = ax.barh([i - h / 2 for i in y], after_pct, height=h, color=ACCENT, label="après")
    bar_labels(ax, b1, fmt="{:.0f}%", pad=1, horizontal=True)
    bar_labels(ax, b2, fmt="{:.0f}%", pad=1, horizontal=True)
    ax.set_yticks(list(y)); ax.set_yticklabels(labels)
    ax.set_xlim(0, 118); ax.set_xticks([0, 25, 50, 75, 100])
    ax.set_title("Champs exploitables, avant et après nettoyage")
    ax.legend(frameon=False, fontsize=11, labelcolor=MUTED, loc="lower right")
    ax.xaxis.grid(True); ax.set_axisbelow(True)
    save(fig, "04_completeness")

    # what the weighting did to the perfect-but-thin scores
    thin = df[(df["note"] >= 5) & (df["nombre_avis"] <= 3)]
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    ax.scatter(df["nombre_avis"] + 1, df["note"], s=26, color=NEUTRAL, alpha=.55, label="note brute")
    ax.scatter(df["nombre_avis"] + 1, df["note_ajustee"], s=26, color=ACCENT, alpha=.85, label="note ajustée")
    ax.scatter(thin["nombre_avis"] + 1, thin["note"], s=34, facecolors="none", edgecolors=BAD,
               linewidths=1.3, label=f"5.0 sur ≤3 avis ({len(thin)})")
    ax.set_xscale("log")
    ax.set_xlabel("nombre d'avis (échelle log)"); ax.set_ylabel("note")
    ax.set_title("Pondérer la note par le nombre d'avis")
    ax.legend(frameon=False, fontsize=10.5, labelcolor=MUTED, loc="lower right")
    ax.yaxis.grid(True); ax.set_axisbelow(True)
    save(fig, "05_rating_adjustment")


if __name__ == "__main__":
    main()
