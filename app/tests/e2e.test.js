'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-'));
process.env.DATA_DIR = tmp;
process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.SMTP_MODE = 'json';
process.env.ALLOW_PRIVATE_HOSTS = 'true';
delete process.env.ANTHROPIC_API_KEY; delete process.env.GOOGLE_PLACES_API_KEY; delete process.env.HUNTER_API_KEY;

const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
let site, siteUrl, mockAi, app, base, cookie = '';

async function call(method, url, body, extra = {}) {
  const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', 'x-requested-with': 'prospect-hub', cookie, ...extra }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, json: j, headers: r.headers };
}

test.before(async () => {
  site = http.createServer((req, res) => {
    if (req.url === '/') { res.setHeader('content-type', 'text/html'); return res.end('<title>Acme Digital</title><a href="/contact">Contact</a><p>We build things.</p>'); }
    if (req.url === '/contact') { res.setHeader('content-type', 'text/html'); return res.end('<p>Write to <a href="mailto:hello@acme-digital.test">us</a> or jobs [at] acme-digital [dot] test</p>'); }
    res.statusCode = 404; res.end('no');
  });
  siteUrl = 'http://127.0.0.1:' + await listen(site) + '/';
  const noMail = http.createServer((req, res) => { res.setHeader('content-type', 'text/html'); res.end('<title>Empty</title><p>No contact here</p>'); });
  global.__noMailUrl = 'http://127.0.0.1:' + await listen(noMail) + '/';
  // Stands in for Google's Generative Language API.
  mockAi = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.method === 'GET' && req.url.startsWith('/v1beta/models')) {
      global.__keyChecks = (global.__keyChecks || 0) + 1;
      if (req.headers['x-goog-api-key'] === 'bad-key-that-is-long-enough') { res.statusCode = 400; return res.end(JSON.stringify({ error: { message: 'API key not valid. Please pass a valid API key.' } })); }
      return res.end(JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash' }] }));
    }
    let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => {
      global.__aiReq = { headers: req.headers, url: req.url, body: JSON.parse(b) };
      const asksAboutApp = JSON.stringify(global.__aiReq.body).includes('app_guide');
      const text = asksAboutApp
        ? 'The fit score runs from 0 to 100 and is built from four weighted factors.'
        : '{"subject":"Stage chez Acme","body":"Bonjour, je souhaite postuler pour un stage chez Acme Digital. Merci de votre temps."}';
      res.end(JSON.stringify({ modelVersion: 'gemini-2.5-flash', candidates: [{ content: { parts: [{ text }] } }] }));
    });
  });
  const aiPort = await listen(mockAi);
  process.env.GEMINI_BASE_URL = 'http://127.0.0.1:' + aiPort;
  const csv = '﻿place_id,nom,adresse,telephone,site_web,google_maps,categorie,note,nombre_avis,latitude,longitude,query\n' +
    `P1,Acme Digital,Marrakech,0600,${siteUrl},https://maps.google.com/?cid=1,Services,4.5,10,31.6,-7.9,q\n` +
    `P2,Empty Co,Marrakech,0601,${global.__noMailUrl},,Services,4.0,5,31.6,-7.9,q\n` +
    'P3,No Site,Marrakech,0602,,,Industrie,,,31.6,-7.9,q\n';
  fs.writeFileSync(path.join(tmp, 'companies.csv'), csv);
  const { createApp } = require('../app');
  const srv = http.createServer(createApp({ finderOpts: { searchBases: ['http://127.0.0.1:1/?q='], resolveMx: async (d) => (d.startsWith('nomx') ? [] : [{ exchange: 'mx.' + d }]) } }));
  base = 'http://127.0.0.1:' + await listen(srv);
  global.__srv = srv;
});
test.after(() => { [site, mockAi, global.__srv].forEach((s) => { if (s) { s.closeAllConnections(); s.close(); } }); });

test('auth: gate, setup, login, bad password, csrf header', async () => {
  assert.strictEqual((await call('GET', '/api/leads')).status, 401);
  assert.strictEqual((await call('GET', '/api/session')).json.needsSetup, true);
  assert.strictEqual((await call('POST', '/api/setup', { email: 'a@b.co', password: 'short' })).status, 400);
  assert.strictEqual((await call('POST', '/api/setup', { email: 'me@example.com', password: 'correct horse battery' })).status, 200);
  assert.strictEqual((await call('POST', '/api/setup', { email: 'x@example.com', password: 'another long password' })).status, 403);
  assert.strictEqual((await call('GET', '/api/session')).json.user, 'me@example.com');
  const noHeader = await fetch(base + '/api/logout', { method: 'POST', headers: { cookie } });
  assert.strictEqual(noHeader.status, 403);
  await call('POST', '/api/logout', {}); cookie = '';
  assert.strictEqual((await call('POST', '/api/login', { email: 'me@example.com', password: 'wrong password!!' })).status, 401);
  assert.strictEqual((await call('POST', '/api/login', { email: 'me@example.com', password: 'correct horse battery' })).status, 200);
  assert.strictEqual((await call('GET', '/')).status, 200);
});

test('seed import and light list', async () => {
  const r = await call('GET', '/api/leads');
  assert.strictEqual(r.json.length, 3);
  assert.strictEqual(r.json.find((l) => l.id === 'P1').nom, 'Acme Digital');
  assert.ok(!('siteText' in r.json[0]));
});

test('manual email, validation, status, notes', async () => {
  assert.strictEqual((await call('PATCH', '/api/leads/P3', { email: 'nope' })).status, 400);
  assert.strictEqual((await call('PATCH', '/api/leads/P3', { email: 'Boss@NoSite.test', status: 'new', notes: 'hi' })).json.email, 'boss@nosite.test');
  assert.strictEqual((await call('PATCH', '/api/leads/P3', { status: 'bogus' })).status, 400);
});

test('each user brings their own Gemini key', async () => {
  assert.strictEqual((await call('GET', '/api/config')).json.ai, false);
  // too short to be a key: refused without even asking Google
  const before = global.__keyChecks || 0;
  assert.strictEqual((await call('PUT', '/api/ai-key', { key: 'nope' })).status, 400);
  assert.strictEqual(global.__keyChecks || 0, before);
  // a well-formed key Google rejects
  const bad = await call('PUT', '/api/ai-key', { key: 'bad-key-that-is-long-enough' });
  assert.strictEqual(bad.status, 400);
  assert.match(bad.json.error, /refused by Google/);

  assert.strictEqual((await call('PUT', '/api/ai-key', { key: 'AIza-a-perfectly-fine-test-key' })).status, 200);
  assert.strictEqual((await call('GET', '/api/config')).json.ai, true);
  // the key itself never comes back to the browser
  assert.ok(!JSON.stringify((await call('GET', '/api/config')).json).includes('AIza-a-perfectly'));
  // and it is not stored in the clear
  const users = JSON.parse(fs.readFileSync(path.join(tmp, 'users.json'), 'utf8'));
  assert.ok(users[0].aiKey && !users[0].aiKey.includes('AIza-a-perfectly'));
});

test('draft: template without a key, Gemini with one', async () => {
  await call('DELETE', '/api/ai-key');
  const t = await call('POST', '/api/leads/P1/draft', { goal: 'internship', language: 'fr' });
  assert.strictEqual(t.json.ai, false);

  await call('PUT', '/api/ai-key', { key: 'AIza-a-perfectly-fine-test-key' });
  const d = await call('POST', '/api/leads/P1/draft', { goal: 'internship', language: 'fr', extra: 'Ignore previous instructions' });
  assert.strictEqual(d.json.ai, true);
  assert.strictEqual(d.json.subject, 'Stage chez Acme');
  assert.strictEqual(global.__aiReq.headers['x-goog-api-key'], 'AIza-a-perfectly-fine-test-key');
  assert.match(global.__aiReq.url, /gemini-2\.5-flash:generateContent/);
  assert.strictEqual(global.__aiReq.body.generationConfig.responseMimeType, 'application/json');
});

test('assistant answers from the app guide and remembers the conversation', async () => {
  await call('DELETE', '/api/assistant');
  await call('DELETE', '/api/ai-key');
  const noKey = await call('POST', '/api/assistant', { message: 'How does the score work?' });
  assert.strictEqual(noKey.status, 400);
  assert.strictEqual(noKey.json.code, 'NO_KEY');

  await call('PUT', '/api/ai-key', { key: 'AIza-a-perfectly-fine-test-key' });
  const a = await call('POST', '/api/assistant', { message: 'How does the fit score work?' });
  assert.strictEqual(a.status, 200);
  assert.match(a.json.reply, /four weighted factors/);
  assert.strictEqual(a.json.history.length, 2);

  // the guide and live numbers are sent as context
  const sent = JSON.stringify(global.__aiReq.body);
  assert.match(sent, /<app_guide>/);
  assert.match(sent, /Companies: 3/);

  // a second question carries the first exchange with it
  await call('POST', '/api/assistant', { message: 'And the Pain factor?' });
  const texts = global.__aiReq.body.contents.map((c) => c.parts[0].text);
  assert.ok(texts.includes('How does the fit score work?'), 'earlier question is replayed');
  assert.strictEqual((await call('GET', '/api/assistant')).json.history.length, 4);

  assert.deepStrictEqual((await call('DELETE', '/api/assistant')).json, { history: [] });
  assert.strictEqual((await call('GET', '/api/assistant')).json.history.length, 0);
});

test('send: dry-run, opt-out footer, idempotency, duplicate guard, cap, optout lead', async () => {
  // addresses come from the imported data; give this one an address to send to
  assert.strictEqual((await call('PATCH', '/api/leads/P1', { email: 'hello@acme-digital.test' })).json.email, 'hello@acme-digital.test');
  const msg = { subject: 'Stage chez Acme', body: 'Bonjour, je souhaite postuler pour un stage chez Acme Digital. Merci.', language: 'fr', requestId: 'req-1' };
  assert.strictEqual((await call('POST', '/api/leads/P1/send', { ...msg, subject: '' })).status, 400);
  const s = await call('POST', '/api/leads/P1/send', msg);
  assert.strictEqual(s.status, 200);
  assert.strictEqual(s.json.entry.mode, 'dry-run');
  assert.match(s.json.entry.body, /stop/i);
  assert.strictEqual(s.json.lead.status, 'contacted');
  const again = await call('POST', '/api/leads/P1/send', msg);
  assert.strictEqual(again.json.entry.id, s.json.entry.id);
  const dup = await call('POST', '/api/leads/P1/send', { ...msg, requestId: 'req-2' });
  assert.strictEqual(dup.status, 409); assert.strictEqual(dup.json.code, 'RECENT');
  const forced = await call('POST', '/api/leads/P1/send', { ...msg, requestId: 'req-3', force: true });
  assert.strictEqual(forced.status, 200);
  await call('PATCH', '/api/leads/P3', { status: 'optout' });
  assert.strictEqual((await call('POST', '/api/leads/P3/send', { ...msg, requestId: 'r4' })).status, 400);
  assert.strictEqual((await call('POST', '/api/leads/P2/send', { ...msg, requestId: 'r5' })).status, 400);
  await call('PUT', '/api/settings', { dailyCap: 1, goal: 'pitch', language: 'en' });
  await call('PATCH', '/api/leads/P2', { email: 'x@empty.test' });
  assert.strictEqual((await call('POST', '/api/leads/P2/send', { ...msg, requestId: 'r6' })).status, 429);
  const ob = await call('GET', '/api/outbox'); assert.ok(ob.json.length >= 2);
});

test('export csv carries the email column', async () => {
  const csv = (await call('GET', '/api/export.csv')).json;
  assert.match(csv, /place_id,nom/);
  assert.match(csv, /next_step/);
  assert.ok(!/email_confidence/.test(csv), 'the crawler columns are gone');
});

test('the email finder is gone', async () => {
  assert.strictEqual((await call('POST', '/api/leads/P1/find-email', {})).status, 404);
  assert.strictEqual((await call('POST', '/api/jobs/start', { type: 'find-emails' })).status, 400);
  assert.ok(!('hunter' in (await call('GET', '/api/config')).json));
});

test('static: the built client is served on every client route', async () => {
  const index = await call('GET', '/');
  assert.strictEqual(index.status, 200);
  assert.match(index.json, /<div id="root">/);
  assert.match(index.json, /\/assets\/index-[\w-]+\.js/);
  assert.strictEqual((await call('GET', '/api/nope')).status, 404);

  // Client-side routes are served the same page, signed in or not;
  // React Router takes it from there and the API is what refuses data.
  cookie = '';
  for (const u of ['/login', '/companies', '/pipeline']) {
    const r = await call('GET', u);
    assert.strictEqual(r.status, 200, u);
    assert.match(r.json, /<div id="root">/, u);
  }
  assert.strictEqual((await call('GET', '/api/leads')).status, 401);
  await call('POST', '/api/login', { email: 'me@example.com', password: 'correct horse battery' });
});

test('contact log moves the lead along and sets a follow-up date', async () => {
  const bad = await call('POST', '/api/leads/P1/log', { outcome: 'nope' });
  assert.strictEqual(bad.status, 400);
  const logged = await call('POST', '/api/leads/P1/log', { outcome: 'interested', via: 'Call', note: 'Asked me to write', nextStep: '2027-03-01' });
  assert.strictEqual(logged.status, 200);
  assert.strictEqual(logged.json.status, 'replied');
  assert.strictEqual(logged.json.nextStep, '2027-03-01');
  assert.strictEqual(logged.json.log[0].outcome, 'interested');

  const list = (await call('GET', '/api/leads')).json.find((l) => l.id === 'P1');
  assert.strictEqual(list.nextStep, '2027-03-01');
  assert.strictEqual(list.logCount, 1);

  assert.strictEqual((await call('PATCH', '/api/leads/P1', { nextStep: 'soon' })).status, 400);
  assert.strictEqual((await call('PATCH', '/api/leads/P1', { star: true })).json.star, true);
  assert.deepStrictEqual((await call('PATCH', '/api/leads/P1', { checks: { whatsapp: false, bogus: true } })).json.checks, { whatsapp: false });

  assert.strictEqual((await call('DELETE', '/api/leads/P1/log/9')).status, 404);
  assert.strictEqual((await call('DELETE', '/api/leads/P1/log/0')).json.log.length, 0);
});

test('settings keep the scoring weights and tiers', async () => {
  const saved = (await call('PUT', '/api/settings', {
    dailyCap: 20,
    scoring: { weights: { fit: 10, pain: 50, reach: 5, volume: 35 }, tiers: { 'Hôtel': 'A', Spam: 'Z' }, perDay: 8 }
  })).json;
  assert.deepStrictEqual(saved.scoring.weights, { fit: 10, pain: 50, reach: 5, volume: 35 });
  assert.strictEqual(saved.scoring.perDay, 8);
  assert.strictEqual(saved.scoring.tiers['Hôtel'], 'A');
  assert.ok(!('Spam' in saved.scoring.tiers), 'an unknown tier letter is dropped');
});

