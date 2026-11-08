'use strict';
const express = require('express');
const store = require('./store');
const auth = require('./auth');
const places = require('./places');
const ai = require('./ai');
const mailer = require('./mailer');
const jobs = require('./jobs');
const assistant = require('./assistant');
const { createAdminApi } = require('./admin');

const DAY = 24 * 3600 * 1000;
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

function lightLead(l) {
  return {
    id: l.id, nom: l.nom, adresse: l.adresse, telephone: l.telephone, site_web: l.site_web, google_maps: l.google_maps, categorie: l.categorie,
    note: l.note, nombre_avis: l.nombre_avis, latitude: l.latitude, longitude: l.longitude, status: l.status,
    email: l.email, placesStatus: l.placesStatus,
    sentLog: (l.sent || []).map((s) => ({ at: s.at, ok: s.ok })), hasNotes: !!l.notes,
    nextStep: l.nextStep || '', star: !!l.star, snooze: l.snooze || '', checks: l.checks || {},
    logCount: (l.log || []).length, lastLog: (l.log || [])[0] || null
  };
}
function createApi(opts = {}) {
  const r = express.Router();
  const fetchFn = opts.fetchFn || fetch;
  const db = () => store.get();
  const leadOr404 = (req, res) => { const l = db().leads[req.params.id]; if (!l) { res.status(404).json({ error: 'Lead not found.' }); return null; } return l; };

  /* ----- session ----- */
  r.post('/login', async (req, res) => {
    const email = clip(req.body && req.body.email, 120), password = clip(req.body && req.body.password, 200);
    const k = req.ip + '|' + email.toLowerCase();
    const wait = auth.lockState(k);
    if (wait) return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} minute(s).` });
    const user = await auth.checkLogin(email, password);
    if (!user) { auth.noteFail(k); return res.status(401).json({ error: 'Incorrect email or password.' }); }
    auth.noteOk(k); auth.setSession(req, res, user); res.json({ ok: true, user });
  });
  r.post('/logout', (req, res) => { auth.clearSession(res); res.json({ ok: true }); });
  r.get('/session', (req, res) => {
    const s = auth.sessionFrom(req);
    res.json({ user: s ? s.u : null, needsSetup: !auth.hasUsers(), allowSignup: db().settings.allowSignup !== false });
  });

  /* ----- sign-up ----- */
  const signupHits = new Map();
  r.post('/signup', async (req, res) => {
    if (db().settings.allowSignup === false) return res.status(403).json({ error: 'Registration is closed. Ask an administrator for an account.' });

    // A handful of accounts per address per hour is plenty for a real person.
    const now = Date.now();
    const hits = (signupHits.get(req.ip) || []).filter((t) => now - t < 3600000);
    if (hits.length >= 5) return res.status(429).json({ error: 'Too many accounts created from here. Try again later.' });

    const b = req.body || {};
    const email = clip(b.email, 120).trim().toLowerCase();
    const password = clip(b.password, 200);
    const confirm = clip(b.confirm, 200);

    if (!auth.validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password !== confirm) return res.status(400).json({ error: 'The two passwords do not match.' });
    if (password.length < auth.MIN_PASSWORD) return res.status(400).json({ error: `The password needs at least ${auth.MIN_PASSWORD} characters.` });
    // Say the same thing whether or not the address is taken, so this cannot be
    // used to find out who already has an account.
    if (auth.getUser(email)) return res.status(409).json({ error: 'That address cannot be used. Try another, or sign in.' });

    try { auth.createUser(email, password); } catch (e) { return res.status(400).json({ error: e.message }); }
    hits.push(now); signupHits.set(req.ip, hits);
    auth.setSession(req, res, email);
    res.status(201).json({ ok: true, user: email });
  });
  r.post('/setup', async (req, res) => {
    if (auth.hasUsers()) return res.status(403).json({ error: 'An account already exists.' });
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);
    if (!local && process.env.ALLOW_REMOTE_SETUP !== 'true') return res.status(403).json({ error: 'First-time setup is only allowed from this computer.' });
    try { auth.createUser(req.body.email, req.body.password); } catch (e) { return res.status(400).json({ error: e.message }); }
    auth.setSession(req, res, String(req.body.email).trim().toLowerCase()); res.json({ ok: true });
  });

  /* ----- everything below needs a session ----- */
  r.use((req, res, next) => { const s = auth.sessionFrom(req); if (!s) return res.status(401).json({ error: 'Please sign in.' }); req.user = s.u; next(); });

  r.get('/config', (req, res) => res.json({
    user: req.user, isAdmin: auth.isAdmin(req.user),
    ai: auth.hasAiKey(req.user), model: ai.MODEL(), smtp: mailer.mode(),
    places: !!process.env.GOOGLE_PLACES_API_KEY, statuses: store.STATUSES
  }));

  r.use('/admin', createAdminApi());

  /* ----- the signed-in person's own Gemini key ----- */
  r.put('/ai-key', async (req, res) => {
    const value = String((req.body && req.body.key) || '').trim();
    if (value.length < 20 || value.length > 200 || /\s/.test(value)) return res.status(400).json({ error: 'That does not look like an API key.' });
    try { await ai.checkKey(value, fetchFn); } catch (e) { return res.status(400).json({ error: e.message }); }
    try {
      auth.setAiKey(req.user, value);
    } catch (e) {
      // Google accepted the key; the failure is ours (unwritable data directory,
      // missing account). Say which, instead of a blank "something went wrong".
      console.error('Could not store the AI key for', req.user, '-', e.message);
      return res.status(500).json({ error: `The key is valid but could not be saved: ${e.message}` });
    }
    res.json({ ai: true, model: ai.MODEL() });
  });
  r.delete('/ai-key', (req, res) => { auth.setAiKey(req.user, ''); res.json({ ai: false }); });

  /* ----- help assistant ----- */
  const askHits = new Map();
  r.get('/assistant', (req, res) => res.json({ history: assistant.history(req.user), ai: auth.hasAiKey(req.user) }));
  r.delete('/assistant', (req, res) => { assistant.clear(req.user); res.json({ history: [] }); });
  r.post('/assistant', async (req, res) => {
    const key = auth.getAiKey(req.user);
    if (!key) return res.status(400).json({ code: 'NO_KEY', error: 'Add your Gemini API key in Settings to use the assistant.' });
    const now = Date.now(); const hits = (askHits.get(req.user) || []).filter((t) => now - t < 60000);
    if (hits.length >= 20) return res.status(429).json({ error: 'Slow down: 20 questions per minute at most.' });
    hits.push(now); askHits.set(req.user, hits);
    try { res.json(await assistant.ask(req.user, req.body && req.body.message, key, fetchFn)); }
    catch (e) { res.status(e.status || 502).json({ error: e.message }); }
  });
  r.get('/settings', (req, res) => res.json(db().settings));
  r.put('/settings', (req, res) => {
    const b = req.body || {}, s = db().settings, snd = b.sender || {};
    s.sender = { name: clip(snd.name, 80), role: clip(snd.role, 160), background: clip(snd.background, 800) };
    s.goal = b.goal === 'pitch' ? 'pitch' : 'internship';
    s.language = b.language === 'en' ? 'en' : 'fr';
    s.period = clip(b.period, 100); s.signature = clip(b.signature, 400); s.replyTo = auth.validEmail(b.replyTo) ? b.replyTo : '';
    s.optOut = { fr: clip(b.optOut && b.optOut.fr, 300) || store.DEFAULT_SETTINGS.optOut.fr, en: clip(b.optOut && b.optOut.en, 300) || store.DEFAULT_SETTINGS.optOut.en };
    s.dailyCap = Math.max(1, Math.min(200, parseInt(b.dailyCap, 10) || 20));
    if (b.scoring) {
      const d = store.DEFAULT_SETTINGS.scoring, w = b.scoring.weights || {};
      const num = (v, dflt) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : dflt; };
      s.scoring = {
        weights: { fit: num(w.fit, d.weights.fit), pain: num(w.pain, d.weights.pain), reach: num(w.reach, d.weights.reach), volume: num(w.volume, d.weights.volume) },
        tiers: {}, perDay: Math.max(1, Math.min(50, parseInt(b.scoring.perDay, 10) || d.perDay)), icpOnly: b.scoring.icpOnly !== false
      };
      for (const [k, v] of Object.entries(b.scoring.tiers || {})) if (['A', 'B', 'C', 'D', 'X'].includes(v)) s.scoring.tiers[clip(k, 80)] = v;
    }
    store.save(); res.json(s);
  });

  /* ----- leads ----- */
  r.get('/leads', (req, res) => res.json(Object.values(db().leads).map(lightLead)));
  r.get('/leads/:id', (req, res) => { const l = leadOr404(req, res); if (l) res.json(l); });
  r.patch('/leads/:id', (req, res) => {
    const l = leadOr404(req, res); if (!l) return;
    const b = req.body || {};
    if (b.status !== undefined) { if (!store.STATUSES.includes(b.status)) return res.status(400).json({ error: 'Unknown status.' }); l.status = b.status; }
    if (b.notes !== undefined) l.notes = clip(b.notes, 4000);
    const isDate = (v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (b.nextStep !== undefined) { if (!isDate(b.nextStep)) return res.status(400).json({ error: 'Dates must look like 2026-03-01.' }); l.nextStep = b.nextStep; }
    if (b.snooze !== undefined) { if (!isDate(b.snooze)) return res.status(400).json({ error: 'Dates must look like 2026-03-01.' }); l.snooze = b.snooze; }
    if (b.star !== undefined) l.star = !!b.star;
    if (b.checks !== undefined && b.checks && typeof b.checks === 'object') {
      const out = {};
      for (const k of ['live', 'mobile', 'whatsapp', 'chat', 'booking']) if (typeof b.checks[k] === 'boolean') out[k] = b.checks[k];
      l.checks = out;
    }
    if (b.email !== undefined) {
      const e = String(b.email).trim().toLowerCase();
      if (e && !auth.validEmail(e)) return res.status(400).json({ error: 'That email address does not look valid.' });
      l.email = e;
    }
    store.save(); res.json(l);
  });
  r.post('/leads/:id/places', async (req, res) => {
    const l = leadOr404(req, res); if (!l) return;
    const key = process.env.GOOGLE_PLACES_API_KEY; if (!key) return res.status(400).json({ error: 'GOOGLE_PLACES_API_KEY is not set.' });
    try { const d = await places.placeDetails(l.id, key, fetchFn); const changes = places.applyDetails(l, d); store.save(); res.json({ lead: l, changes }); }
    catch (e) { res.status(502).json({ error: e.message }); }
  });

  /* ----- contact log (call, WhatsApp, visit...) ----- */
  const OUTCOMES = { no_answer: 'contacted', callback: 'contacted', interested: 'replied', demo: 'meeting', not_interested: 'lost', wrong: 'lost', won: 'won' };
  r.post('/leads/:id/log', (req, res) => {
    const l = leadOr404(req, res); if (!l) return;
    const b = req.body || {};
    if (!OUTCOMES[b.outcome]) return res.status(400).json({ error: 'Unknown outcome.' });
    if (b.nextStep && !/^\d{4}-\d{2}-\d{2}$/.test(b.nextStep)) return res.status(400).json({ error: 'Dates must look like 2026-03-01.' });
    l.log = l.log || [];
    l.log.unshift({ at: new Date().toISOString(), outcome: b.outcome, via: clip(b.via, 30), note: clip(b.note, 1000) });
    l.log = l.log.slice(0, 200);
    l.status = OUTCOMES[b.outcome];
    if (b.nextStep !== undefined) l.nextStep = b.nextStep;
    store.save(); res.json(l);
  });
  r.delete('/leads/:id/log/:i', (req, res) => {
    const l = leadOr404(req, res); if (!l) return;
    const i = parseInt(req.params.i, 10);
    if (!Number.isInteger(i) || i < 0 || i >= (l.log || []).length) return res.status(404).json({ error: 'No such log entry.' });
    l.log.splice(i, 1); store.save(); res.json(l);
  });

  /* ----- background jobs ----- */
  r.get('/jobs/current', (req, res) => res.json(jobs.current()));
  r.post('/jobs/cancel', (req, res) => res.json(jobs.cancel()));
  r.post('/jobs/start', async (req, res) => {
    const type = req.body && req.body.type, all = Object.values(db().leads);
    try {
      if (type === 'places') {
        const key = process.env.GOOGLE_PLACES_API_KEY; if (!key) return res.status(400).json({ error: 'GOOGLE_PLACES_API_KEY is not set.' });
        const items = all.filter((l) => !l.site_web && !l.placesCheckedAt).slice(0, 500);
        const out = await jobs.start(type, items, async (l) => { const d = await places.placeDetails(l.id, key, fetchFn); const ch = places.applyDetails(l, d); store.save(); return { found: ch.includes('website') }; }, { concurrency: 4 });
        return res.json(out);
      }
      res.status(400).json({ error: 'Unknown job type.' });
    } catch (e) { res.status(e.code === 'BUSY' ? 409 : 500).json({ error: e.message }); }
  });

  /* ----- AI draft ----- */
  const draftHits = new Map();
  r.post('/leads/:id/draft', async (req, res) => {
    const l = leadOr404(req, res); if (!l) return;
    const now = Date.now(); const hits = (draftHits.get(req.user) || []).filter((t) => now - t < 60000);
    if (hits.length >= 20) return res.status(429).json({ error: 'Slow down: 20 drafts per minute at most.' });
    hits.push(now); draftHits.set(req.user, hits);
    const b = req.body || {}, settings = db().settings;
    const ctx = { lead: l, settings, goal: b.goal === 'pitch' ? 'pitch' : 'internship', language: b.language === 'en' ? 'en' : 'fr', tone: clip(b.tone, 30), extra: clip(b.extra, 300) };
    let out, aiError = null;
    const key = auth.getAiKey(req.user);
    if (key) {
      try { out = await ai.draftEmail(ctx, key, fetchFn); } catch (e) { aiError = e.message; }
    }
    if (!out) out = { ...ai.templateDraft(ctx), ai: false };
    l.draft = { ...out, at: new Date().toISOString(), goal: ctx.goal, language: ctx.language };
    store.save();
    res.json({ ...out, aiError, language: ctx.language });
  });

  /* ----- send ----- */
  const recent = new Map();
  r.post('/leads/:id/send', async (req, res) => {
    const l = leadOr404(req, res); if (!l) return;
    const b = req.body || {}, settings = db().settings;
    const rid = clip(b.requestId, 60);
    if (rid && recent.has(rid)) return res.json(recent.get(rid));
    if (!l.email || !auth.validEmail(l.email)) return res.status(400).json({ error: 'This lead has no valid email address yet.' });
    if (l.status === 'optout') return res.status(400).json({ error: 'This lead is marked "do not contact".' });
    const subject = clip(b.subject, 150).replace(/[\r\n]+/g, ' ').trim(), body = clip(b.body, 4000).trim();
    if (subject.length < 3) return res.status(400).json({ error: 'Write a subject first.' });
    if (body.length < 20) return res.status(400).json({ error: 'The message is too short.' });
    const lang = b.language === 'en' ? 'en' : 'fr';
    const optOut = (settings.optOut[lang] || '').trim(); if (!optOut) return res.status(400).json({ error: 'Add an opt-out line in Settings first.' });
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const today = Object.values(db().leads).reduce((n, x) => n + (x.sent || []).filter((s) => s.ok && new Date(s.at) >= startOfDay).length, 0);
    if (today >= settings.dailyCap) return res.status(429).json({ error: `Daily limit reached (${settings.dailyCap}). Change it in Settings or continue tomorrow.` });
    const lastOk = (l.sent || []).filter((s) => s.ok).slice(-1)[0];
    if (lastOk && Date.now() - new Date(lastOk.at) < 14 * DAY && !b.force) return res.status(409).json({ code: 'RECENT', error: `You already emailed this address on ${lastOk.at.slice(0, 10)}.`, last: lastOk.at });
    const text = body + '\n\n' + (settings.signature ? settings.signature.trim() + '\n\n' : '') + optOut;
    const entry = { id: 's' + Date.now().toString(36), at: new Date().toISOString(), to: l.email, subject, body: text, language: lang };
    try {
      const out = await mailer.send({ to: l.email, subject, text, replyTo: settings.replyTo });
      Object.assign(entry, { ok: true, mode: out.mode, messageId: out.messageId });
      if (l.status === 'new') l.status = 'contacted';
    } catch (e) { Object.assign(entry, { ok: false, mode: mailer.mode(), error: clip(e.message, 200) }); }
    l.sent = l.sent || []; l.sent.push(entry); store.save();
    const payload = { ok: entry.ok, entry, lead: l, error: entry.error || null };
    if (rid) { recent.set(rid, payload); setTimeout(() => recent.delete(rid), 10 * 60 * 1000).unref(); }
    res.status(entry.ok ? 200 : 502).json(payload);
  });
  r.get('/outbox', (req, res) => {
    const rows = [];
    for (const l of Object.values(db().leads)) for (const s of l.sent || []) rows.push({ ...s, leadId: l.id, company: l.nom });
    rows.sort((a, b) => (a.at < b.at ? 1 : -1)); res.json(rows.slice(0, 500));
  });

  /* ----- data in and out ----- */
  r.get('/export.csv', (req, res) => { res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="entreprises_avec_email.csv"'); res.send(store.exportCsv()); });
  return r;
}
module.exports = { createApi, lightLead };
