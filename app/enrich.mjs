#!/usr/bin/env node
// Prospect Ledger v2: website checker.
//
//   node enrich.mjs companies.json            -> writes enrichment.json
//   node enrich.mjs companies.json out.json --concurrency 8 --force
//
// Needs Node 18+ (built-in fetch). No packages. Run it on your own computer:
// it visits each company's website once and records what it finds.
// Import the result in the app: Data tab -> Import.
//
// Notes on reading the results:
//  - true  = found in the page HTML
//  - false = not found in the page HTML
//  - missing = could not tell (site is a JavaScript shell, or the page failed)
//  Widgets injected late by JavaScript can be missed, so treat "false" as a
//  strong hint and confirm on the lead's detail panel before you pitch it.

import fs from 'node:fs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--concurrency'));
const inFile = positional[0] || 'companies.json';
const outFile = positional[1] || 'enrichment.json';
const CONCURRENCY = Number(opt('--concurrency', 6));
const TIMEOUT_MS = Number(opt('--timeout', 12000));
const FORCE = flag('--force');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const RX = {
  viewport: /<meta[^>]+name=["']viewport["']/i,
  whatsapp: /wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com|whatsapp:\/\/|joinchat|click-to-chat|ctc-|class=["'][^"']*whatsapp/i,
  pixel: /fbq\(|connect\.facebook\.net|googletagmanager\.com|gtag\(|G-[A-Z0-9]{6,}/i,
};

const CHAT_TOOLS = {
  tidio: /tidio/i, crisp: /crisp\.chat/i, tawk: /tawk\.to/i, intercom: /intercom/i, drift: /js\.driftt?\.com/i,
  livechat: /livechatinc|livechat\.com/i, zendesk: /zopim|zendesk/i, hubspot: /hs-scripts|hubspot/i,
  manychat: /manychat/i, botpress: /botpress/i, smartsupp: /smartsupp/i, olark: /olark/i, freshchat: /freshchat/i,
  messenger: /fb-customerchat|customerchat|m\.me\//i, chatbot: /chatbot|chat-widget|chatwidget/i,
};
const BOOKING_TOOLS = {
  calendly: /calendly/i, simplybook: /simplybook/i, cloudbeds: /cloudbeds/i, lodgify: /lodgify/i, smoobu: /smoobu/i,
  sirvoy: /sirvoy/i, roomcloud: /roomcloud/i, beds24: /beds24/i, checkfront: /checkfront/i, booksy: /booksy/i,
  zenchef: /zenchef/i, thefork: /thefork|lafourchette/i, opentable: /opentable/i, resiliosoft: /resiliosoft/i,
  form: /(book(ing)?[ -]?now|réserver|reserver|réservation|reservation|book a (room|table|tour))/i,
};

function matchAll(map, html) {
  return Object.entries(map).filter(([, rx]) => rx.test(html)).map(([k]) => k);
}

function textLength(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

const SOCIAL_HOST = /(facebook\.com|instagram\.com|linktr\.ee|wa\.me|tiktok\.com|youtube\.com|linkedin\.com|booking\.com|tripadvisor\.|airbnb\.|business\.site|g\.page|goo\.gl|maps\.app)/i;

export function analyze(html, finalUrl, status) {
  const out = { status, finalUrl, https: /^https:/i.test(finalUrl) };
  // Bot walls (403, 429, ...) say nothing about whether the site is up.
  if ([401, 403, 406, 429, 451, 999].includes(status)) { out.blocked = true; return out; }
  out.live = status < 400 && html.length > 200;
  if (!out.live) return out;

  out.mobile = RX.viewport.test(html);
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) out.title = t[1].replace(/\s+/g, ' ').trim().slice(0, 120);

  // A near-empty body usually means a JavaScript app; absence of widgets
  // in the HTML then proves nothing, so leave those fields unknown.
  const shell = textLength(html) < 400;
  const w = RX.whatsapp.test(html);
  const chat = matchAll(CHAT_TOOLS, html);
  const book = matchAll(BOOKING_TOOLS, html);
  if (w || !shell) out.whatsapp = w;
  if (chat.length || !shell) { out.chat = chat.length > 0; if (chat.length) out.chatTools = chat; }
  if (book.length || !shell) { out.booking = book.length > 0; if (book.length) out.bookingTools = book; }
  out.pixel = RX.pixel.test(html);

  const emails = [...new Set((html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [])
    .map((e) => e.toLowerCase())
    .filter((e) => !/\.(png|jpe?g|gif|svg|webp)$/.test(e) && !/(sentry|wixpress|example\.)/.test(e)))].slice(0, 3);
  if (emails.length) out.emails = emails;

  const social = {};
  const ig = html.match(/instagram\.com\/([A-Za-z0-9._]{2,30})(?=[\/"'?\s])/);
  const fb = html.match(/facebook\.com\/(?!sharer|tr\?|plugins|dialog|common)([A-Za-z0-9.\-]{3,60})(?=[\/"'?\s])/);
  if (ig && !/^(p|reel|explore|accounts)$/.test(ig[1])) social.instagram = 'https://instagram.com/' + ig[1];
  if (fb) social.facebook = 'https://facebook.com/' + fb[1];
  if (Object.keys(social).length) out.social = social;
  return out;
}

async function check(company) {
  const url = company.site_web;
  const rec = { checked: new Date().toISOString() };
  if (!url) return rec;
  let host = '';
  try { host = new URL(url).hostname; } catch { rec.error = 'bad url'; return rec; }
  if (SOCIAL_HOST.test(host)) { rec.skipped = 'social or listing page'; return rec; }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow', signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'fr,en;q=0.8' },
    });
    const html = (await res.text()).slice(0, 1_500_000);
    Object.assign(rec, analyze(html, res.url || url, res.status));
  } catch (e) {
    rec.live = false;
    rec.error = e.name === 'AbortError' ? 'timeout' : String(e.cause?.code || e.message || e).slice(0, 80);
  } finally {
    clearTimeout(timer);
  }
  return rec;
}

async function main() {
  const companies = JSON.parse(fs.readFileSync(inFile, 'utf8'));
  let items = {};
  if (!FORCE && fs.existsSync(outFile)) {
    try { items = JSON.parse(fs.readFileSync(outFile, 'utf8')).items || {}; } catch { /* start fresh */ }
  }
  const todo = companies.filter((c) => c.site_web && !items[c.id]);
  console.log(`${companies.length} companies, ${companies.filter((c) => c.site_web).length} with a website, ${todo.length} to check`);

  let done = 0, cursor = 0;
  const save = () => fs.writeFileSync(outFile, JSON.stringify({ kind: 'enrichment', generated: new Date().toISOString(), items }, null, 1));
  async function worker() {
    while (cursor < todo.length) {
      const c = todo[cursor++];
      items[c.id] = await check(c);
      done++;
      const r = items[c.id];
      const tag = r.skipped ? 'skip' : r.live ? 'ok  ' : 'DOWN';
      console.log(`[${done}/${todo.length}] ${tag} ${c.nom.slice(0, 48)}`);
      if (done % 10 === 0) save();
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  save();
  console.log(`Wrote ${outFile}. Import it in the app: Data tab -> Import.`);
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();
