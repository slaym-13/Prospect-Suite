'use strict';
// Google Gemini client. Each person brings their own API key, so every call takes
// the key as an argument; nothing here reads a key from the environment.
const BASE = () => (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
const MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
function city(addr) { const m = String(addr || '').match(/([A-Za-zÀ-ÿ' -]+)\s+\d{4,5}\s*$/); return m ? m[1].trim() : 'Marrakech'; }

/** Turn Gemini's error shapes into something worth showing a person. */
function apiError(status, json) {
  const message = (json && json.error && json.error.message) || `HTTP ${status}`;
  if (status === 400 && /API key not valid/i.test(message)) return new Error('That API key was refused by Google. Check it and try again.');
  if (status === 403) return new Error('This key is not allowed to use the Gemini API. Enable the Generative Language API for it.');
  if (status === 429) return new Error('Gemini rate limit reached. Wait a moment and try again.');
  return new Error('Gemini: ' + message);
}

/**
 * One call to generateContent.
 * @param {object}   o
 * @param {string}   o.apiKey    the user's Gemini key
 * @param {string}   o.system    system instruction
 * @param {Array}    o.messages  [{ role: 'user'|'model', text }]
 * @param {boolean}  o.json      ask for a JSON response
 * @returns {Promise<{text: string, model: string}>}
 */
async function generate({ apiKey, system, messages, json = false, maxTokens = 2048, temperature = 0.7 }, fetchFn = fetch) {
  if (!apiKey) throw Object.assign(new Error('No Gemini API key set.'), { code: 'NO_KEY' });
  const model = MODEL();
  const body = {
    contents: messages.map((m) => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text }] })),
    generationConfig: { maxOutputTokens: maxTokens, temperature, ...(json ? { responseMimeType: 'application/json' } : null) }
  };
  if (system) body.system_instruction = { parts: [{ text: system }] };
  // The 2.5 models think before answering. These are short, factual replies, so
  // skipping that keeps them fast and stops thinking tokens eating the budget.
  if (model.includes('2.5')) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetchFn(`${BASE()}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw apiError(r.status, j);
    const candidate = (j.candidates || [])[0];
    const text = ((candidate && candidate.content && candidate.content.parts) || []).map((p) => p.text || '').join('').trim();
    if (!text) {
      const reason = candidate && candidate.finishReason;
      throw new Error(reason === 'SAFETY' ? 'Gemini refused to answer that.' : 'Gemini returned no text.');
    }
    return { text, model: j.modelVersion || model };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Gemini took too long to answer.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Cheap check that a key works, used before we store it. */
async function checkKey(apiKey, fetchFn = fetch) {
  const r = await fetchFn(`${BASE()}/v1beta/models`, { headers: { 'x-goog-api-key': apiKey } });
  if (!r.ok) throw apiError(r.status, await r.json().catch(() => ({})));
  return true;
}

/* ---------- first-contact email ---------- */

function systemPrompt(lang) {
  return [
    'You write short first-contact emails on behalf of one sender.',
    'Use only the facts given in <sender> and <company>. Never invent clients, results, prices, deadlines, mutual contacts, or details about the company that are not given.',
    'Be specific when the facts allow it, otherwise stay general. No flattery clichés, no exclamation marks, no emojis.',
    `Write in ${lang === 'en' ? 'English' : 'French'}. Maximum 120 words in the body. One clear, low-pressure ask. Plain text, no markdown.`,
    'Start the body with a greeting. Do not write a signature, a sign-off name, or an opt-out line: the app adds them.',
    'Reply with JSON only, in this shape: {"subject":"...","body":"..."}'
  ].join('\n');
}

function userPrompt({ lead, settings, goal, tone, extra }) {
  const s = settings.sender || {};
  const goalText = goal === 'pitch'
    ? `Introduce a service and offer a short call. What the sender offers: ${clip(s.background, 600) || 'not specified, stay general'}.`
    : `Send a spontaneous application for an internship${settings.period ? ' (' + clip(settings.period, 80) + ')' : ''}. Sender background: ${clip(s.background, 600) || 'not specified, stay general'}.`;
  return [
    `<goal>${goalText}</goal>`,
    `<tone>${clip(tone, 40) || 'professional'}</tone>`,
    `<sender><name>${clip(s.name, 80)}</name><role>${clip(s.role, 160)}</role></sender>`,
    `<company><name>${clip(lead.nom, 120)}</name><category>${clip(lead.categorie, 60)}</category><city>${city(lead.adresse)}</city>` +
      (lead.note ? `<google_rating>${lead.note} (${lead.nombre_avis || 0} reviews)</google_rating>` : '') +
      (lead.site_web ? `<website>${clip(lead.site_web, 120)}</website>` : '') + `</company>`,
    extra ? `<extra_instructions>${clip(extra, 300)}</extra_instructions>` : ''
  ].filter(Boolean).join('\n');
}

function parseDraft(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { const j = JSON.parse(text.slice(a, b + 1)); if (j.subject && j.body) return { subject: String(j.subject).trim(), body: String(j.body).trim() }; } catch { /* fall through */ }
  }
  const lines = text.trim().split('\n'); const subj = lines.shift().replace(/^subject:\s*/i, '').trim();
  return { subject: subj.slice(0, 120), body: lines.join('\n').trim() };
}

async function draftEmail(ctx, apiKey, fetchFn = fetch) {
  const out = await generate(
    { apiKey, system: systemPrompt(ctx.language), messages: [{ role: 'user', text: userPrompt(ctx) }], json: true, maxTokens: 900 },
    fetchFn
  );
  return { ...parseDraft(out.text), ai: true, model: out.model };
}

/** Plain template used when the person has not set a key. Facts only, filled from settings. */
function templateDraft({ lead, settings, goal, language }) {
  const s = settings.sender || {}; const fr = language !== 'en'; const name = lead.nom.split(/\s[-–|]\s/)[0];
  if (goal === 'pitch') {
    return fr ? {
      subject: `Une idée pour ${name}`,
      body: `Bonjour,\n\nJe m'appelle ${s.name || '[votre nom]'}${s.role ? ', ' + s.role : ''}. ${clip(s.background, 300) || '[décrivez en une phrase ce que vous proposez]'}\n\nSeriez-vous disponible pour un échange de 15 minutes cette semaine ou la suivante ?\n\nCordialement,`
    } : {
      subject: `An idea for ${name}`,
      body: `Hello,\n\nMy name is ${s.name || '[your name]'}${s.role ? ', ' + s.role : ''}. ${clip(s.background, 300) || '[describe what you offer in one sentence]'}\n\nWould you have 15 minutes for a call this week or next?\n\nBest regards,`
    };
  }
  return fr ? {
    subject: `Candidature spontanée${settings.period ? ' : ' + clip(settings.period, 60) : ' pour un stage'}`,
    body: `Bonjour,\n\nJe m'appelle ${s.name || '[votre nom]'}${s.role ? ', ' + s.role : ''}. ${clip(s.background, 300)}\n\nJe vous écris pour proposer ma candidature à un stage${settings.period ? ' (' + clip(settings.period, 60) + ')' : ''} au sein de ${name}. Seriez-vous disposé à échanger quelques minutes à ce sujet ?\n\nCordialement,`
  } : {
    subject: `Internship application${settings.period ? ': ' + clip(settings.period, 60) : ''}`,
    body: `Hello,\n\nMy name is ${s.name || '[your name]'}${s.role ? ', ' + s.role : ''}. ${clip(s.background, 300)}\n\nI am writing to apply for an internship${settings.period ? ' (' + clip(settings.period, 60) + ')' : ''} at ${name}. Would you be open to a short conversation about it?\n\nBest regards,`
  };
}

module.exports = { generate, checkKey, draftEmail, templateDraft, parseDraft, userPrompt, systemPrompt, MODEL };
