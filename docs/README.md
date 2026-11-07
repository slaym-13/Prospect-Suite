# Prospect Ledger v2

A single-page prospecting app for 283 AI and tech-adjacent companies in Marrakech (Google Places listings). It ranks them by how good a fit they are for a WhatsApp or DM automation pitch, and tracks every contact through to a win or loss.

Open `index.html` in any modern browser. No install, no server, no internet needed (fonts fall back to system fonts offline).

## Files

| File | Purpose |
|---|---|
| `index.html` | The app. Company data is embedded in the file. |
| `companies.json` | The same 283 companies as a plain list. Input for `enrich.mjs`. |
| `enrich.mjs` | Optional website checker. Needs Node 18 or newer. |
| `CHANGELOG.md` | What changed from v1. |

## A daily routine

1. Open **Today**. Work through **Follow-ups due** first, then **Start with**.
2. Click a lead. Call or WhatsApp from the buttons (the number is also shown so you can copy it).
3. Back in the card, **Log a contact**: how, outcome, a note, next step date. Save.
4. The stage updates by itself and the lead returns to Today on the date you set.
5. Once a week, open **Data** and copy a backup.

## Tabs

| Tab | What it does |
|---|---|
| **Today** | Follow-ups due, leads in conversation with no next step, and the top new leads by score (5 a day by default). "Skip 7 days" hides a lead for a week. A badge on the tab counts what is due. |
| **Leads** | Full table. Search by name, address or phone. Filter by category, stage, website type, mobile only, starred. Click a column heading to sort. |
| **Pipeline** | Board with Not contacted, Contacted, Replied, Won and Lost. Drag a card, or use the stage menu on the card (works on a phone). |
| **Compare** | Two to four companies side by side. The best value in each row is green. |
| **Categories** | Count, no-own-site count, average rating and score per category. Select a name for its top players and website gaps. |
| **Scoring** | Weights, category tiers, and the top 8 right now. |
| **Data** | Export, import, website-check status, erase. |

## The lead card

Click any company to open its card.

- **Contact:** phone, address, Google rating, website, and Call, WhatsApp, Email, Maps and Site buttons. WhatsApp appears only for mobile numbers (06, 07, +212). Email appears once a website check (`enrichment.json`) has found an address, and opens your mail app.
- **Fit score:** the total and a breakdown by factor, each with a plain-language reason.
- **Pipeline:** stage and next step date.
- **Website checks:** five questions (site live, works on a phone, WhatsApp button, chat widget, online booking). Each is **?**, **Yes** or **No**. Your answer overrides any automatic result and changes the Pain score.
- **Log a contact:** newest first. Delete an entry with ✕.
- **Notes:** free text, saved as you type.

Press Escape or click outside the card to close it.

## How the score works

A number from 0 to 100. Four factors, each weighted:

| Factor | Default weight | Scores high when |
|---|---|---|
| Category fit | 30 | The line of work is valuable (hotels, travel, real estate, health) |
| Pain | 30 | No website, a social page only, a free builder site, or a site missing WhatsApp, chat or booking |
| Reach | 15 | A mobile number exists (landline counts half) |
| Volume | 25 | Many Google reviews, which suggests many customer messages |

Change the weights with the sliders on **Scoring**. Every list re-ranks as you move one.

**Category tiers:** each category is A (best fit), B, C, D (weak) or Excluded. Excluded categories score 0 and are hidden from rankings and from Today. The defaults are my starting guesses. Adjust them on **Scoring** or **Categories**.

## Website checks (optional)

Without this step, Pain is based only on the website address. Running the checker makes it more precise.

1. Put `companies.json` and `enrich.mjs` in one folder.
2. Run `node enrich.mjs companies.json`.
3. It writes `enrichment.json`. In the app, go to **Data → Import**, choose the file, press **Read**, then **Apply**.

Useful options: `--concurrency 8`, `--timeout 15000`, `--force` (re-check everything). If it stops, run it again and it resumes.

How to read the results: **No** means "not found in the page HTML". A widget added late by JavaScript can be missed, so open the site to confirm before you pitch the gap. Sites that are only a JavaScript shell are left as unknown, not "No".

## Your data

- Everything you enter is stored in your browser on this device. Nothing is sent anywhere.
- A copy of `index.html` opened from your disk and the hosted version keep separate data. Use **Backup** to move between them.
- Clearing site data, using a private window, or switching browsers shows an empty app. Keep a backup.
- If the browser blocks storage, a banner on **Data** says so and changes last only until you close the page.

### Export
On **Data**, press **Backup (JSON)**, **Leads (CSV)** or **Company list (JSON)**, then **Copy all**. The CSV pastes straight into a spreadsheet and includes score, stage, next step, last outcome and notes.

### Import
One box accepts three kinds of file and detects which it is:

| File | Effect |
|---|---|
| Backup | Replaces your current notes, stages and settings |
| `enrichment.json` | Adds website check results. Scores update. |
| Company list (JSON array) | Replaces the 283 companies. Notes are kept and matched by company `id`. Each entry needs `id` and `nom`. |

You always see what was found and press **Apply** before anything changes.

### Erase
**Data → Erase my notes, stages and settings** asks for a second confirmation.

## Company list format

Each company in `companies.json`:

```json
{
  "id": "ChIJ...",
  "nom": "Company name",
  "adresse": "Address",
  "telephone": "06 12 34 56 78",
  "google_maps": "https://maps.google.com/?cid=...",
  "categorie": "Hôtel",
  "latitude": 31.63,
  "longitude": -7.98,
  "site_web": "https://example.com",
  "note": 4.5,
  "nombre_avis": 120
}
```

`site_web` is an empty string when there is no website. `note` and `nombre_avis` can be `null`.

## Limits

- Mobile-number detection assumes Moroccan formats.
- Tap-to-call and WhatsApp links depend on your browser and device having a handler for them.
- Scoring defaults are starting points. Revisit them after your first batch of calls, when you can see which kinds of lead reply.
