'use strict';
require('dotenv').config();
const { createApp } = require('./app');
const auth = require('./lib/auth');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const app = createApp();

if (!auth.hasUsers() && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  try { auth.createUser(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD); console.log('Created the first account from ADMIN_EMAIL. You can now remove ADMIN_PASSWORD from .env.'); }
  catch (e) { console.error('Could not create the first account:', e.message); }
}
app.listen(PORT, HOST, () => {
  console.log(`Prospect Hub is running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  if (!auth.hasUsers()) console.log('No account yet: open the page and create one, or run: npm run create-user -- you@example.com "a long password"');
});
