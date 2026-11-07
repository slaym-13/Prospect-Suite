'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { DATA_DIR } = require('./store');

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SECRET_FILE = path.join(DATA_DIR, '.secret');
const COOKIE = 'ph_session';
const MAX_AGE_S = 7 * 24 * 3600;
const MIN_PASSWORD = 10;

function readUsers() { try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return []; } }
function writeUsers(u) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2), { mode: 0o600 }); }
function secret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 24) return process.env.SESSION_SECRET;
  try { return fs.readFileSync(SECRET_FILE, 'utf8').trim(); } catch { /* create */ }
  const s = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SECRET_FILE, s, { mode: 0o600 });
  return s;
}
let SECRET = null;
const key = () => SECRET || (SECRET = secret());

function validEmail(e) { return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120; }

/* ---------- per-user AI key ----------
   Each person brings their own Gemini key. It is encrypted at rest with a key
   derived from the session secret, and never sent back to the browser. */
const aesKey = () => crypto.createHash('sha256').update('ai-key|' + key()).digest();
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', aesKey(), iv);
  const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return [iv.toString('base64url'), c.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}
function decrypt(blob) {
  try {
    const [iv, tag, data] = String(blob).split('.');
    const d = crypto.createDecipheriv('aes-256-gcm', aesKey(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
  } catch {
    return null; // wrong secret, or the file was edited by hand
  }
}

/** Store (or clear, with an empty value) this user's AI key. */
function setAiKey(email, plain) {
  const users = readUsers();
  const u = users.find((x) => x.email === email);
  if (!u) throw new Error('No such account.');
  if (plain) u.aiKey = encrypt(plain);
  else delete u.aiKey;
  writeUsers(users);
}
function getAiKey(email) {
  const u = readUsers().find((x) => x.email === email);
  return u && u.aiKey ? decrypt(u.aiKey) : null;
}
function hasAiKey(email) { return !!getAiKey(email); }

function createUser(email, password, { role = 'user', allowShortPassword = false } = {}) {
  email = String(email || '').trim().toLowerCase();
  if (!validEmail(email)) throw new Error('Enter a valid email address.');
  if (typeof password !== 'string' || (!allowShortPassword && password.length < MIN_PASSWORD)) {
    throw new Error(`The password needs at least ${MIN_PASSWORD} characters.`);
  }
  const users = readUsers().filter((u) => u.email !== email);
  users.push({
    email,
    hash: bcrypt.hashSync(password, 12),
    role: role === 'admin' ? 'admin' : 'user',
    createdAt: new Date().toISOString()
  });
  writeUsers(users);
}

/* ---------- accounts and roles ---------- */

/** Everything the admin screen may see. Never the hash, never the AI key. */
function listUsers() {
  return readUsers().map((u) => ({
    email: u.email,
    role: u.role === 'admin' ? 'admin' : 'user',
    createdAt: u.createdAt || null,
    hasAiKey: !!u.aiKey,
    defaultPassword: !!u.defaultPassword
  }));
}
function getUser(email) { return readUsers().find((u) => u.email === String(email || '').trim().toLowerCase()) || null; }
function isAdmin(email) { const u = getUser(email); return !!u && u.role === 'admin'; }
function countAdmins() { return readUsers().filter((u) => u.role === 'admin').length; }

function setPassword(email, password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    throw new Error(`The password needs at least ${MIN_PASSWORD} characters.`);
  }
  const users = readUsers();
  const u = users.find((x) => x.email === email);
  if (!u) throw new Error('No such account.');
  u.hash = bcrypt.hashSync(password, 12);
  delete u.defaultPassword;   // whatever it is now, it is no longer the shipped one
  writeUsers(users);
}

function setRole(email, role) {
  const users = readUsers();
  const u = users.find((x) => x.email === email);
  if (!u) throw new Error('No such account.');
  const next = role === 'admin' ? 'admin' : 'user';
  // Locking everyone out of the admin screen is not a recoverable mistake.
  if (u.role === 'admin' && next !== 'admin' && countAdmins() <= 1) throw new Error('This is the last administrator.');
  u.role = next;
  writeUsers(users);
}

function deleteUser(email) {
  const users = readUsers();
  const u = users.find((x) => x.email === email);
  if (!u) throw new Error('No such account.');
  if (u.role === 'admin' && countAdmins() <= 1) throw new Error('This is the last administrator.');
  writeUsers(users.filter((x) => x.email !== email));
}

const DEFAULT_ADMIN = { email: 'admin@prospecthub.com', password: 'adminPH' };

/**
 * Make sure the administrator account exists at startup.
 *
 * This runs on every boot because a host may hand us an empty disk each deploy. The
 * account named by ADMIN_EMAIL is created if it is missing and promoted if it is not
 * an administrator, so the documented login always works. An existing password is
 * never overwritten.
 */
function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN.email).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN.password;
  const users = readUsers();
  const hadAccounts = users.length > 0;
  const hadAdmin = users.some((u) => u.role === 'admin');
  const existing = users.find((u) => u.email === email);

  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      writeUsers(users);
      console.log(`Promoted ${email} to administrator.`);
    }
    if (existing.defaultPassword) {
      console.warn(`  ${email} still uses the development password. Set ADMIN_PASSWORD, or change it on the Admin page.`);
    }
    return { email, created: false };
  }

  createUser(email, password, { role: 'admin', allowShortPassword: true });
  if (password === DEFAULT_ADMIN.password) {
    // Flag it so later boots can keep warning without re-hashing to find out.
    const list = readUsers();
    list.find((u) => u.email === email).defaultPassword = true;
    writeUsers(list);
    console.warn(
      `
  Development administrator created` +
      `
    email:    ${email}` +
      `
    password: ${password}` +
      `
  Set ADMIN_EMAIL and ADMIN_PASSWORD before deploying this.
`
    );
  } else {
    console.log(`Created the administrator account ${email}.`);
  }

  // An install that predates roles keeps its original owner as an administrator,
  // rather than being quietly demoted by the upgrade.
  if (hadAccounts && !hadAdmin) {
    const list = readUsers();
    const oldest = list
      .filter((u) => u.email !== email)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0];
    if (oldest) {
      oldest.role = 'admin';
      writeUsers(list);
      console.log(`Kept ${oldest.email} as an administrator.`);
    }
  }
  return { email, created: true };
}

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);
async function checkLogin(email, password) {
  email = String(email || '').trim().toLowerCase();
  const u = readUsers().find((x) => x.email === email);
  const ok = await bcrypt.compare(String(password || ''), u ? u.hash : DUMMY_HASH);  // same work whether or not the user exists
  return u && ok ? u.email : null;
}
function hasUsers() { return readUsers().length > 0; }

/* signed, stateless session token */
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', key()).update(body).digest('base64url');
  return body + '.' + mac;
}
function verify(token) {
  if (typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [body, mac] = token.split('.');
  const exp = crypto.createHmac('sha256', key()).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(exp);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
function parseCookies(h) {
  const out = {};
  String(h || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function sessionFrom(req) { const t = parseCookies(req.headers.cookie)[COOKIE]; return t ? verify(t) : null; }
function setSession(req, res, email) {
  const secure = process.env.COOKIE_SECURE === 'true' || req.secure;
  const tok = sign({ u: email, exp: Date.now() + MAX_AGE_S * 1000 });
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(tok)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_S}${secure ? '; Secure' : ''}`);
}
function clearSession(res) { res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`); }

/* brute-force guard: 5 failures per ip+email, then 15 minutes */
const fails = new Map();
function lockState(k) { const f = fails.get(k); if (f && f.until && f.until > Date.now()) return Math.ceil((f.until - Date.now()) / 1000); return 0; }
function noteFail(k) { const f = fails.get(k) || { n: 0, until: 0 }; if (f.until && f.until <= Date.now()) { f.n = 0; f.until = 0; } f.n++; if (f.n >= 5) { f.until = Date.now() + 15 * 60 * 1000; f.n = 0; } fails.set(k, f); }
function noteOk(k) { fails.delete(k); }

module.exports = {
  createUser, checkLogin, hasUsers, sessionFrom, setSession, clearSession,
  lockState, noteFail, noteOk, validEmail, MIN_PASSWORD,
  setAiKey, getAiKey, hasAiKey,
  listUsers, getUser, isAdmin, countAdmins, setPassword, setRole, deleteUser, seedAdmin, DEFAULT_ADMIN
};
