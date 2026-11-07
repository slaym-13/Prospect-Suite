'use strict';
// The in-app help assistant. It answers questions about how to use Prospect Hub.
//
// Its "memory" is three things:
//   1. KNOWLEDGE  - a written guide to the app, below. This is what it knows.
//   2. snapshot() - a few live numbers from the person's own data.
//   3. history    - the conversation so far, kept per user in db.json.
const store = require('./store');
const ai = require('./ai');

const MAX_TURNS = 20;          // kept per person; older messages are dropped
const MAX_QUESTION = 1000;

/** Everything the assistant knows about the product. Edit this when the app changes. */
const KNOWLEDGE = `
# Prospect Hub

A web app for finding companies in Marrakech, contacting them (usually with a
spontaneous internship application or a service pitch), and tracking the replies.
The company list comes from Google Places: 283 companies with name, address, phone,
website, category, rating and review count.

## Pages

- **Dashboard** - headline numbers and four charts: the outreach funnel, email coverage
  by category, Google rating bands, and the pipeline. Every chart has a "Table" toggle
  that shows the same figures as numbers. Filters at the top narrow everything by
  category and status. Buttons: "Fill websites (Places)" when a Google key is set, and
  "Download CSV with emails".
- **Today** - the day's work. "Follow-ups due" lists companies whose next-step date has
  arrived. "Needs a next step" lists companies in conversation with no date set.
  "Start with" suggests the best untouched companies by fit score, five at a time
  (change that number in Settings). "Skip 7 days" hides a company for a week.
- **Companies** - the full table. Search by name, address or category; filter by email
  state (has email, none, not searched, no website) and by status; sort by any column.
  "Download CSV" exports everything, scores and statuses included.
  Click any row to open that company.
- **Pipeline** - a board with columns New, Contacted, Replied, Meeting, Won, Lost.
  Drag a card to another column, or use the dropdown on the card (which works on a
  phone). Each column shows its 40 highest-scoring companies.
- **Outbox** - every message the app tried to send, newest first, with the result.
- **Settings** - who you are, sending limits, the AI key, the scoring weights and the
  category tiers.

## The company panel (click any company)

- **Details**: status dropdown, address, phone, website, Google rating, and the contact
  buttons. Call, WhatsApp, Email, Maps and Site each appear only when they can work -
  WhatsApp needs a Moroccan mobile number (06, 07, +212), Email needs an address in the
  data, Site needs a website.
- **Fit score**: the 0-100 score with a bar and a sentence for each of the four factors.
- **Next step**: the follow-up date that puts the company back on Today. Shortcuts for
  "In 3 days" and "In a week".
- **Write & send**: choose a goal (internship request or service pitch), a language
  (French or English) and a tone (formal, warm, very short). "Write draft with AI" fills
  the subject and body; edit them freely, then "Send email".
- **Log a contact**: record a call, WhatsApp message, Instagram DM, visit or email, with
  an outcome. The outcome moves the company along the pipeline automatically:
  "No answer" and "Call back later" set Contacted; "Interested" sets Replied; "Demo or
  meeting set" sets Meeting; "Not interested" and "Wrong number or closed" set Lost;
  "Won" sets Won. It also proposes a follow-up date.
- **Website checks**: five yes/no questions (site live, works on a phone, WhatsApp
  button, chat widget, online booking). Answering them makes the Pain score accurate.
- **Notes**: private free text.

## The fit score

A number from 0 to 100 built from four weighted factors. The weights are on Settings
and every list re-ranks when you change them.

- **Category fit** (default weight 30): how promising the line of work is. Each category
  is graded A (best fit), B, C, D or Excluded. Excluded categories score 0 and never
  appear on Today. Hotels, guest houses, travel agencies, estate agencies, health and
  restaurants are A by default.
- **Pain** (30): highest when the company has no website at all, then a social page only,
  then a free builder site, then its own domain. Failing website checks add to it.
- **Reach** (15): a mobile number scores full, a landline half, no phone zero.
- **Volume** (25): more Google reviews means more customer messages, on a log scale.

## Email addresses

Addresses ship with the company data. About half the 283 companies have one. A
company's address is shown in its Details panel and in the Email column on the
Companies page; the Email button in the contact row opens your mail app with a new
message to it. The "Has email" / "No email" filter on Companies narrows the list. The
app does not search the web for addresses, and there is no import screen: the dataset
is part of the application and loads itself on first start.

## Sending rules

Sending needs SMTP details in the server's .env file; without them the Send button
reports that sending is off. Protections that always apply: your opt-out line is added
to every message, a List-Unsubscribe header is set, there is a daily cap (20 by
default, change it in Settings), the app refuses to email the same company twice
within 14 days unless you confirm, and a company marked "Do not contact" can never be
emailed. In dry-run mode messages are logged in the Outbox but never delivered.

## The AI

Each person adds their own Google Gemini API key on the Settings page. It is encrypted
before it is stored and never shown again. The key powers two things: the email drafts
and this assistant. Without a key the app still works - "Write draft with AI" falls
back to a plain fill-in-the-blanks template. Get a key free at
https://aistudio.google.com/apikey

## Good to know

- Light, dark and automatic themes: the button in the top right cycles between them.
- Data lives in data/db.json on the server, so everyone signed in sees the same
  companies, statuses and notes. The AI key is the only per-person setting.
- An AI draft can be wrong. Read every message before sending it.
`;

/** A few live numbers so the assistant can answer "how many..." about real data. */
function snapshot() {
  const leads = Object.values(store.get().leads);
  const n = leads.length;
  if (!n) return 'The company list is empty.';
  const withEmail = leads.filter((l) => l.email).length;
  const withSite = leads.filter((l) => l.site_web).length;
  const byStatus = {};
  for (const l of leads) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
  const due = leads.filter((l) => l.nextStep && l.nextStep <= new Date().toISOString().slice(0, 10)).length;
  const sent = leads.reduce((t, l) => t + (l.sent || []).filter((s) => s.ok).length, 0);
  return [
    `Companies: ${n}`,
    `With an email address: ${withEmail}`,
    `With a website: ${withSite}`,
    `By status: ${Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(', ')}`,
    `Follow-ups due today: ${due}`,
    `Emails sent so far: ${sent}`
  ].join('\n');
}

const SYSTEM = `You are the built-in help assistant for Prospect Hub, a web app the user is signed into right now.

Answer questions about how to use the app, using the guide in <app_guide>. The guide is
the truth about this app: never invent a page, button or setting that is not in it. If
the guide does not cover something, say so plainly and suggest the closest thing that
does exist.

<live_data> holds current numbers from this user's own database. Use it when they ask
about their data. It is a summary, not the full list: for anything more specific, point
them at the page that shows it.

Be brief and concrete. Name the page and the button to press. Two or three sentences is
usually enough; use a short list only for genuine step-by-step instructions. Plain text,
no markdown headings, no emoji. Match the language the user writes in (French or English).

You only answer questions about this app. If asked about anything else, say that is
outside what you can help with here.`;

function conversations() {
  const db = store.get();
  if (!db.assistant || typeof db.assistant !== 'object') db.assistant = {};
  return db.assistant;
}

function history(user) {
  return conversations()[user] || [];
}

function clear(user) {
  delete conversations()[user];
  store.save();
}

/**
 * Answer one question and remember the exchange.
 * @returns {Promise<{reply: string, history: Array}>}
 */
async function ask(user, question, apiKey, fetchFn = fetch) {
  const text = String(question || '').trim().slice(0, MAX_QUESTION);
  if (!text) throw Object.assign(new Error('Ask a question first.'), { status: 400 });

  const past = history(user);
  const context = `<app_guide>\n${KNOWLEDGE}\n</app_guide>\n\n<live_data>\n${snapshot()}\n</live_data>`;
  const messages = [
    // The guide goes in as the opening exchange so it stays in front of the model
    // without being repeated on every turn of the conversation.
    { role: 'user', text: context + '\n\nAcknowledge in one word that you have read this.' },
    { role: 'model', text: 'Ready.' },
    ...past.map((m) => ({ role: m.role, text: m.text })),
    { role: 'user', text }
  ];

  const out = await ai.generate({ apiKey, system: SYSTEM, messages, maxTokens: 800, temperature: 0.3 }, fetchFn);

  const conv = conversations();
  conv[user] = [...past, { role: 'user', text, at: new Date().toISOString() }, { role: 'model', text: out.text, at: new Date().toISOString() }]
    .slice(-MAX_TURNS * 2);
  store.save();
  return { reply: out.text, history: conv[user] };
}

module.exports = { ask, history, clear, snapshot, KNOWLEDGE, SYSTEM };
