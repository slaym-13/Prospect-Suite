'use strict';
// Administration: accounts, and the company records themselves.
//
// Every route here is behind requireAdmin. The ordinary API lets a user change the
// working state of a company (status, notes, follow-up); this one lets an
// administrator correct the underlying record, add or delete companies, and reload
// the shipped dataset.
const express = require('express');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const auth = require('./auth');

const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

/** The seed file, wherever it happens to live on this host. */
function seedFile() {
  return [path.join(store.DATA_DIR, 'companies.csv'), path.join(__dirname, '..', 'data', 'companies.csv')]
    .find((file) => fs.existsSync(file));
}

function createAdminApi() {
  const r = express.Router();

  r.use((req, res, next) => {
    if (!auth.isAdmin(req.user)) return res.status(403).json({ error: 'Administrators only.' });
    next();
  });

  /* ----- overview ----- */
  r.get('/stats', (req, res) => {
    const leads = Object.values(store.get().leads);
    const byStatus = {};
    for (const l of leads) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    res.json({
      companies: leads.length,
      withEmail: leads.filter((l) => l.email).length,
      withWebsite: leads.filter((l) => l.site_web).length,
      contacted: leads.filter((l) => l.status !== 'new').length,
      sent: leads.reduce((n, l) => n + (l.sent || []).filter((s) => s.ok).length, 0),
      logged: leads.reduce((n, l) => n + (l.log || []).length, 0),
      byStatus,
      allowSignup: store.get().settings.allowSignup !== false,
      users: auth.listUsers().length,
      admins: auth.countAdmins()
    });
  });

  /* ----- accounts ----- */
  r.get('/users', (req, res) => res.json(auth.listUsers()));

  r.post('/users', (req, res) => {
    const b = req.body || {};
    try {
      auth.createUser(b.email, b.password, { role: b.role === 'admin' ? 'admin' : 'user' });
      res.status(201).json(auth.listUsers());
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.patch('/users/:email', (req, res) => {
    const email = String(req.params.email).toLowerCase();
    const b = req.body || {};
    if (!auth.getUser(email)) return res.status(404).json({ error: 'No such account.' });
    try {
      if (b.password !== undefined) auth.setPassword(email, b.password);
      if (b.role !== undefined) {
        // Removing your own admin rights locks you out of this screen immediately.
        if (email === req.user && b.role !== 'admin') return res.status(400).json({ error: 'You cannot remove your own administrator rights.' });
        auth.setRole(email, b.role);
      }
      res.json(auth.listUsers());
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.delete('/users/:email', (req, res) => {
    const email = String(req.params.email).toLowerCase();
    if (email === req.user) return res.status(400).json({ error: 'You cannot delete the account you are signed in with.' });
    try {
      auth.deleteUser(email);
      res.json(auth.listUsers());
    } catch (e) {
      res.status(e.message === 'No such account.' ? 404 : 400).json({ error: e.message });
    }
  });

  /** Open or close public registration. */
  r.patch('/signup', (req, res) => {
    const enabled = (req.body || {}).enabled;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'Send {"enabled": true} or {"enabled": false}.' });
    store.get().settings.allowSignup = enabled;
    store.save();
    res.json({ allowSignup: enabled });
  });

  /* ----- company records ----- */
  r.post('/leads', (req, res) => {
    const b = req.body || {};
    try {
      const lead = store.addLead({
        place_id: clip(b.place_id, 120), nom: clip(b.nom, 200), adresse: clip(b.adresse, 300),
        telephone: clip(b.telephone, 40), site_web: clip(b.site_web, 300), email: clip(b.email, 160),
        categorie: clip(b.categorie, 80), google_maps: clip(b.google_maps, 400),
        note: b.note, nombre_avis: b.nombre_avis, latitude: b.latitude, longitude: b.longitude,
        query: 'manuel'
      });
      res.status(201).json(lead);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.patch('/leads/:id', (req, res) => {
    const b = req.body || {};
    const fields = {};
    for (const [k, max] of [['nom', 200], ['adresse', 300], ['telephone', 40], ['site_web', 300],
                            ['email', 160], ['categorie', 80], ['google_maps', 400]]) {
      if (b[k] !== undefined) fields[k] = clip(b[k], max);
    }
    for (const k of ['note', 'nombre_avis', 'latitude', 'longitude']) if (b[k] !== undefined) fields[k] = b[k];
    if (fields.email && !auth.validEmail(fields.email)) return res.status(400).json({ error: 'That email address does not look valid.' });
    try {
      res.json(store.updateLead(req.params.id, fields));
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  });

  r.delete('/leads/:id', (req, res) => {
    try {
      store.removeLead(req.params.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  });

  /** Destructive: drops every company, note and status, then reloads the dataset. */
  r.post('/reset', (req, res) => {
    const file = seedFile();
    if (!file) return res.status(500).json({ error: 'The dataset that ships with the app could not be found.' });
    if ((req.body || {}).confirm !== 'reset') return res.status(400).json({ error: 'Send {"confirm":"reset"} to confirm.' });
    try {
      res.json(store.resetLeads(file));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return r;
}

module.exports = { createAdminApi };
