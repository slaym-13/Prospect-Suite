'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');
const store = require('./lib/store');
const { createApi } = require('./lib/api');

function createApp(opts = {}) {
  store.load();
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    next();
  });

  app.use('/api', express.json({ limit: '1mb' }));
  // Cross-site pages cannot add this header without a CORS preflight, which this server never grants.
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-requested-with') !== 'prospect-hub') return res.status(403).json({ error: 'Missing request header.' });
    res.setHeader('Cache-Control', 'no-store'); next();
  });
  app.use('/api', createApi(opts));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // The React client (Vite build). Hashed asset names, so they can be cached hard; index.html never is.
  const DIST = path.join(__dirname, 'dist');
  const INDEX = path.join(DIST, 'index.html');
  app.get('/favicon.ico', (req, res) => res.status(204).end());
  app.use('/assets', express.static(path.join(DIST, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  app.use(express.static(DIST, { index: false, maxAge: 0 }));
  // Every other GET is a client route: hand back index.html and let React Router decide.
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    if (req.method !== 'GET' || !fs.existsSync(INDEX)) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(INDEX);
  });
  app.use((req, res) => res.status(404).send('Not found. Run "npm run build" if the client has not been built yet.'));
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (req.path.startsWith('/api')) return res.status(err.status || 500).json({ error: err.status === 400 ? 'Bad request.' : 'Something went wrong on the server.' });
    res.status(500).send('Server error');
  });

  // First run: import the companies that ship with the app. On a host where the only
  // writable place is a scratch directory, DATA_DIR points there and starts empty, so
  // fall back to the copy that travels with the source.
  const seed = [path.join(store.DATA_DIR, 'companies.csv'), path.join(__dirname, 'data', 'companies.csv')]
    .find((file) => fs.existsSync(file));
  if (seed && !Object.keys(store.get().leads).length) {
    const r = store.importCsvFile(seed); store.saveNow(); console.log(`Imported ${r.added} companies from ${seed}`);
  }
  return app;
}
module.exports = { createApp };
