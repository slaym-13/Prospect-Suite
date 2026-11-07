# Prospect Ledger v2: changes from v1

Date: 2026-10-08
Source: `projet_da.rar` (Prospect Ledger Suite, 283 Marrakech companies from Google Places)

v2 covers three items from the brainstorm: (1) foundations, (2) fit-based scoring, (3) website enrichment.

---

## Files

| File | What it is |
|---|---|
| `index.html` | The v2 app. Single file, data embedded, works offline. |
| `enrich.mjs` | Website checker. Node 18+, no packages. |
| `companies.json` | The 283 companies as a plain list. Input for `enrich.mjs`. |
| `CHANGELOG.md` | This file. |

---

## 1. Foundations

### What v1 had
- Five separate folders: Ledger, Outreach Board, Side by Side, Category Report, This Week's Calls.
- Each folder held its own 136 KB copy of the data and its own localStorage, so a stage set on the board did not show in the Ledger.
- No notes, no contact history, no follow-up dates.
- No export or import.

### What v2 does
| Change | Detail |
|---|---|
| One app | The five tools become tabs: **Today, Leads, Pipeline, Compare, Categories**, plus **Scoring** and **Data**. |
| One store | Stage, stars, notes, contact log, checks and settings live in a single state object. A change shows up everywhere at once. |
| Data separate from state | The company list and your work are stored apart. You can replace the list and keep your notes (matched by company id). |
| Call log | Each contact records how (Call, WhatsApp, Instagram DM, Visit, Email), the outcome, a note, and a next-step date. Entries can be deleted. |
| Automatic stage changes | An outcome moves the lead: No answer or Call back later → Contacted; Interested or Demo → Replied; Not interested or Wrong number → Lost; Won → Won. |
| Suggested next date | Choosing an outcome pre-fills the next date (No answer +2 days, Call back +3, Interested +2). You can edit it. |
| Today tab | Follow-ups due (overdue marked), leads in conversation with no next step, and the best new leads to start with (default 5, configurable). "Skip 7 days" hides a lead for a week. Shows counts for due, in conversation, contacts logged in 7 days, and won. A badge on the tab shows how many follow-ups are due. |
| Lead drawer | Click any lead: contact details, score breakdown, stage and next date, website checks, contact log, notes. Escape or the backdrop closes it. |
| Pipeline | Columns: Not contacted, Contacted, Replied, Won, Lost. Drag a card, or use the stage menu on the card (works on a phone). The Not contacted column shows the top 12 by score. |
| Leads table | Search, filters (category, stage, website type, mobile only, starred, hide excluded), sortable columns, "show 80 more". |
| Compare | 2 to 4 companies side by side, best value per row marked green, includes the website checks. |
| Categories | Per-category count, no-own-site count, average rating, average score, and a tier selector. Select a category for its top players and website gaps. |
| WhatsApp and call links | Mobile numbers (06/07, +212 forms normalised) get a `wa.me` link. Call, Maps and Site buttons on every card. |
| Export | Backup (JSON), Leads (CSV), Company list (JSON). Shown in a box with a Copy button. |
| Import | One box, type detected automatically: backup, `enrichment.json`, or a replacement company list. Shows what it found and asks before applying. |
| Erase | Two-step confirmation inside the page. |
| Storage safety | Every browser-storage call is guarded. If storage is blocked, a banner warns that changes will not persist. |
| Layout | Works at phone width with no sideways page scroll (tables scroll inside their own box). Light and dark themes, with a toggle. |

Removed: the random weekly "fifteen calls" shortlist. It is replaced by the Today tab, which is ranked by score and driven by your follow-up dates.

---

## 2. Fit-based scoring

### What v1 did
`score = round(9 × (0.5 × rating/5 + 0.5 × log10(reviews+1) / log10(maxReviews+1)))`, a 0 to 9 popularity score. It ranked how established a company is, not how good a prospect it is.

### What v2 does
Score is 0 to 100 and measures fit for a WhatsApp or DM automation pitch. It is the weighted sum of four factors, each between 0 and 1.

| Factor | Default weight | How it is computed |
|---|---|---|
| Category fit | 30 | Tier of the category: A = 1, B = 0.65, C = 0.35, D = 0.15, X (excluded) = 0 |
| Pain | 30 | Website type: none = 1, social page only = 0.9, free builder site = 0.45, own domain = 0.15. A site marked as down = 0.95. For own-domain and builder sites, each confirmed "no" adds: not mobile friendly +0.2, no WhatsApp button +0.3, no chat widget +0.2, no online booking +0.15. Capped at 1. |
| Reach | 15 | Mobile number = 1, landline = 0.5, no number = 0 |
| Volume | 25 | `log10(reviews+1) / log10(101)`, capped at 1 (100 or more reviews = full). More reviews suggests more inbound customer messages. |

- Weights are sliders on the Scoring tab. Each is shown as a percentage of the total, and every list re-ranks as you move one.
- Excluded categories (tier X) score 0, are hidden from rankings by default, and never appear on the Today tab.
- Every lead shows a "why this score" breakdown: points per factor and a plain-language reason.
- Website type is read from the URL: Facebook, Instagram, Linktree, wa.me, TikTok, YouTube, LinkedIn, Booking.com, TripAdvisor, Airbnb, Google listing pages count as "social page only"; Wix, Weebly, WordPress.com, Blogspot, Jimdo, Strikingly, Carrd and similar count as "free builder site".

### Default category tiers
| Tier | Categories |
|---|---|
| A: best fit | Hôtel, Maison d'hôtes, Chambre d'hôtes, Complexe hôtelier, Hostel, Agence de voyages, Agence immobilière, Santé, Restaurant |
| B: good | Services, Consultant, Crèche, Établissement d'enseignement, Université, Espace de coworking, Siège social, Service de livraison |
| C: maybe | Autre, Fabricant, Entreprise de télécommunications |
| D: weak | Magasin, Magasin d'électronique |

These are my defaults, not facts about your market. Change any of them on the Scoring or Categories tab; "Reset tiers" restores them.

---

## 3. Website enrichment

### `enrich.mjs`
```
node enrich.mjs companies.json                 # writes enrichment.json
node enrich.mjs companies.json out.json --concurrency 8 --timeout 15000 --force
```
- Visits each company website once (default 6 at a time, 12 second timeout).
- Resumable: companies already in the output file are skipped unless `--force` is used. Progress is saved every 10 sites.
- Skips social and listing URLs (they need a login), and records that they were skipped.

What it records per site:

| Field | Meaning |
|---|---|
| `live`, `status`, `https` | Whether the site answered, the HTTP status, whether the final address is HTTPS |
| `mobile` | A viewport meta tag is present (proxy for "works on a phone") |
| `whatsapp` | WhatsApp link or click-to-chat widget found |
| `chat`, `chatTools` | A live-chat or chatbot widget found, and which one (Tidio, Crisp, Tawk, Intercom, Messenger, and others) |
| `booking`, `bookingTools` | A booking engine or "book now / réserver" wording found |
| `pixel` | Facebook pixel or Google tag found |
| `emails`, `social`, `title` | Up to 3 emails, an Instagram and Facebook page if linked, the page title |

Handling of unclear cases:
- A page with almost no text (a JavaScript shell) leaves whatsapp, chat and booking blank rather than saying "no".
- Bot-wall responses (401, 403, 406, 429, 451, 999) are recorded as blocked, not as a dead site.
- Network failures and timeouts mark the site as not live, with the error recorded.

### In the app
- Import `enrichment.json` on the Data tab. Scores update at once.
- Each lead has five checks (site live, works on a phone, WhatsApp button, chat widget, online booking), each set to **?**, **Yes** or **No**.
- A manual answer overrides the automatic one. An automatic result is shown as "auto: yes/no" until you override it.
- Found emails and social links appear on the lead card.

---

## Testing done

| What | Result |
|---|---|
| App in a headless browser (desktop width) | Today list renders 5 leads; opening a lead, logging a contact (stage changed to Contacted, entry saved), setting a check to No, switching to every tab, searching, comparing two companies, changing a weight, CSV export (6,051 characters shown), enrichment import preview and apply, reload |
| Phone width (400 px), dark theme | No sideways page scroll on any tab after a layout fix |
| Console errors | None from the app. Only the Google Fonts request failed, because my test workspace blocks that site. The page falls back to system fonts. |
| `enrich.mjs` on a local test server | Correct results for a full site, a bare site, a JavaScript-only page, a 404, an unreachable host, a Facebook URL, and a company with no website |
| `enrich.mjs` on the real 221 websites | **Not run.** My workspace cannot reach those sites. You need to run it on your computer. |

Fixed during testing: the hidden drawer was blocking clicks, and wide tables pushed the page sideways on a phone.

---

## Known limits
- Data lives in one browser. The hosted copy and a local `index.html` keep separate data. Move between them with Backup export and import.
- "No" results from `enrich.mjs` mean not found in the page HTML. Widgets added late by JavaScript can be missed, so confirm on the site before pitching.
- Mobile-number detection assumes Moroccan formats (06, 07, +212, 00212).
- The scoring weights and tiers are starting guesses. Adjust them after your first batch of calls, once you see which kinds of lead reply.

## Not done (from the brainstorm)
Auto-drafted messages, reply-speed test, review mining, map view, other cities, scheduled re-scrape, and the shareable audit page.
