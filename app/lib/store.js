'use strict';
// Tiny JSON-file database. Fine for a few thousand leads; no native modules to compile.
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_SETTINGS = {
  sender: { name: '', role: '', background: '' },
  goal: 'internship',          // 'internship' | 'pitch'
  language: 'fr',              // 'fr' | 'en'
  period: '',                  // e.g. "summer 2027, 2 months"
  signature: '',
  optOut: {
    fr: 'Si vous ne souhaitez plus recevoir de message de ma part, répondez simplement « stop » et je ne vous écrirai plus.',
    en: 'If you would rather not hear from me, just reply "stop" and I will not write again.'
  },
  replyTo: '',
  dailyCap: 20,
  // Lead scoring (ported from the Prospect Ledger). Weights are relative, not percentages.
  scoring: { weights: { fit: 30, pain: 30, reach: 15, volume: 25 }, tiers: {}, perDay: 5, icpOnly: true }
};

const STATUSES = ['new', 'contacted', 'replied', 'meeting', 'won', 'lost', 'optout'];

let db = null;
let timer = null;

function blankDb() { return { version: 1, leads: {}, settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), assistant: {} }; }

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch (e) {
      const bad = DB_FILE + '.corrupt-' + Date.now();
      fs.renameSync(DB_FILE, bad);
      console.error('db.json was unreadable and was moved to', bad);
      db = blankDb();
    }
  } else db = blankDb();
  db.leads = db.leads || {};
  if (!db.assistant || typeof db.assistant !== 'object') db.assistant = {};
  // keep leads saved by older versions usable
  const GONE = ['emails', 'emailManual', 'emailStatus', 'emailCheckedAt', 'emailError', 'siteTitle', 'siteText', 'siteDiscovered'];
  for (const l of Object.values(db.leads)) {
    for (const k of GONE) delete l[k];   // left over from the removed email crawler
    if (l.nextStep === undefined) l.nextStep = '';
    if (!Array.isArray(l.log)) l.log = [];
    if (l.star === undefined) l.star = false;
    if (l.snooze === undefined) l.snooze = '';
    if (!l.checks || typeof l.checks !== 'object') l.checks = {};
  }
  db.settings = mergeSettings(DEFAULT_SETTINGS, db.settings || {});
  return db;
}
function mergeSettings(base, over) {
  const out = JSON.parse(JSON.stringify(base));
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && out[k] && typeof out[k] === 'object') out[k] = mergeSettings(out[k], over[k]);
    else out[k] = over[k];
  }
  return out;
}
function saveNow() {
  if (!db) return;
  clearTimeout(timer);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
function save() { clearTimeout(timer); timer = setTimeout(saveNow, 200); }
function get() { return db || load(); }

/* ---------- CSV ---------- */
const num = (v) => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
function newLead(r) {
  const reviews = num(r.nombre_avis);
  const lead = {
    id: String(r.place_id || r.id || '').trim(),
    nom: String(r.nom || '').trim(),
    adresse: String(r.adresse || '').trim(),
    telephone: String(r.telephone || '').trim(),
    site_web: String(r.site_web || '').trim(),
    google_maps: String(r.google_maps || '').trim(),
    categorie: String(r.categorie || '').trim(),
    note: num(r.note),
    nombre_avis: reviews == null ? null : Math.round(reviews),
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    query: String(r.query || '').trim(),
    status: 'new', notes: '',
    email: '', placesStatus: '', placesCheckedAt: null,
    sent: [], draft: null, createdAt: new Date().toISOString(),
    // pipeline extras: next follow-up date, contact log, star, snooze-until, manual website checks
    nextStep: '', log: [], star: false, snooze: '', checks: {}
  };
  lead.email = String(r.email || '').trim().toLowerCase();
  return lead;
}
function importCsvText(text, { merge = true } = {}) {
  const rows = parse(text, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true, trim: false });
  const d = get();
  let added = 0, updated = 0, skipped = 0;
  for (const r of rows) {
    const l = newLead(r);
    if (!l.id || !l.nom) { skipped++; continue; }
    const ex = d.leads[l.id];
    if (!ex) { d.leads[l.id] = l; added++; continue; }
    if (!merge) { skipped++; continue; }
    for (const k of ['nom', 'adresse', 'telephone', 'google_maps', 'categorie', 'query']) if (l[k]) ex[k] = l[k];
    if (l.site_web) ex.site_web = l.site_web;
    for (const k of ['note', 'nombre_avis', 'latitude', 'longitude']) if (l[k] != null) ex[k] = l[k];
    if (l.email && !ex.email) ex.email = l.email;
    updated++;
  }
  save();
  return { rows: rows.length, added, updated, skipped };
}
function importCsvFile(file, opts) { return importCsvText(fs.readFileSync(file, 'utf8'), opts); }

/* ---------- administration ---------- */

/** The company fields an administrator may correct. Everything else is derived. */
const EDITABLE = ['nom', 'adresse', 'telephone', 'site_web', 'email', 'categorie', 'google_maps', 'query'];
const NUMERIC = ['note', 'nombre_avis', 'latitude', 'longitude'];

function addLead(fields) {
  const d = get();
  const lead = newLead(fields);
  if (!lead.nom) throw new Error('A company needs a name.');
  if (!lead.id) lead.id = 'man-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  if (d.leads[lead.id]) throw new Error('A company with that identifier already exists.');
  d.leads[lead.id] = lead;
  save();
  return lead;
}

function updateLead(id, fields) {
  const lead = get().leads[id];
  if (!lead) throw new Error('No such company.');
  for (const k of EDITABLE) {
    if (fields[k] === undefined) continue;
    lead[k] = String(fields[k]).trim();
  }
  if (lead.email) lead.email = lead.email.toLowerCase();
  for (const k of NUMERIC) {
    if (fields[k] === undefined) continue;
    lead[k] = fields[k] === '' || fields[k] === null ? null : num(fields[k]);
  }
  save();
  return lead;
}

function removeLead(id) {
  const d = get();
  if (!d.leads[id]) throw new Error('No such company.');
  delete d.leads[id];
  save();
}

/** Throw the working data away and load the shipped dataset again. */
function resetLeads(seedFile) {
  const d = get();
  d.leads = {};
  const result = importCsvFile(seedFile);
  saveNow();
  return result;
}

const guard = (v) => { v = v == null ? '' : String(v); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; };
function exportCsv() {
  const cols = ['place_id', 'nom', 'adresse', 'telephone', 'site_web', 'email', 'google_maps', 'categorie', 'note', 'nombre_avis', 'latitude', 'longitude', 'query', 'status', 'next_step', 'last_contacted'];
  const rows = Object.values(get().leads).map((l) => {
    const last = (l.sent || []).filter((s) => s.ok).slice(-1)[0];
    return [l.id, l.nom, l.adresse, l.telephone, l.site_web, l.email, l.google_maps, l.categorie, l.note ?? '', l.nombre_avis ?? '', l.latitude ?? '', l.longitude ?? '', l.query, l.status, l.nextStep || '', last ? last.at : ''].map(guard);
  });
  return '﻿' + stringify([cols, ...rows]);
}

module.exports = {
  load, get, save, saveNow, importCsvText, importCsvFile, exportCsv,
  addLead, updateLead, removeLead, resetLeads,
  DEFAULT_SETTINGS, STATUSES, DATA_DIR, mergeSettings
};
