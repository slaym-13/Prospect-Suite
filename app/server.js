'use strict';
require('dotenv').config();
const { createApp } = require('./app');
const auth = require('./lib/auth');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const app = createApp();

app.listen(PORT, HOST, () => {
  console.log(`Prospect Hub is running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  if (!auth.hasUsers()) console.log('No account yet: open the page and create one, or run: npm run create-user -- you@example.com "a long password"');
});
