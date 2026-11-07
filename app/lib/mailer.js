'use strict';
const nodemailer = require('nodemailer');
let cached = null, cachedKey = '';

function mode() {
  if (process.env.SMTP_MODE === 'json') return 'dry-run';
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return 'smtp';
  return 'off';
}
function transport() {
  const k = mode() + process.env.SMTP_HOST + process.env.SMTP_USER;
  if (cached && k === cachedKey) return cached;
  cachedKey = k;
  if (mode() === 'smtp') {
    const port = Number(process.env.SMTP_PORT || 587);
    cached = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  } else cached = nodemailer.createTransport({ jsonTransport: true });
  return cached;
}
function fromAddress() {
  const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'dry-run@localhost';
  const name = process.env.SMTP_FROM_NAME || '';
  return name ? { name, address: email } : email;
}
async function send({ to, subject, text, replyTo }) {
  if (mode() === 'off') throw Object.assign(new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env (or SMTP_MODE=json for a dry run).'), { code: 'NO_SMTP' });
  const from = fromAddress();
  const fromEmail = typeof from === 'string' ? from : from.address;
  const info = await transport().sendMail({
    from, to, subject, text, replyTo: replyTo || undefined,
    headers: { 'List-Unsubscribe': `<mailto:${fromEmail}?subject=stop>` }
  });
  return { mode: mode(), messageId: info.messageId || '' };
}
module.exports = { send, mode };
