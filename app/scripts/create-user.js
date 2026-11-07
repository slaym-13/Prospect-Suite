'use strict';
require('dotenv').config();
const auth = require('../lib/auth');
const [email, password] = process.argv.slice(2);
if (!email || !password) { console.error('Usage: npm run create-user -- you@example.com "a password of 10+ characters"'); process.exit(1); }
try { auth.createUser(email, password); console.log('Account saved for', email.toLowerCase()); } catch (e) { console.error(e.message); process.exit(1); }
