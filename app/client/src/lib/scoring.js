/**
 * Lead scoring, ported from the Prospect Ledger.
 *
 * A company scores 0-100 on four weighted factors. Pure functions: give them a
 * lead and the scoring settings, get a number and a per-factor explanation back.
 */

export const TIERS = ['A', 'B', 'C', 'D', 'X'];
export const TIER_LABEL = { A: 'A: best fit', B: 'B: good', C: 'C: maybe', D: 'D: weak', X: 'Excluded' };
const TIER_VALUE = { A: 1, B: 0.65, C: 0.35, D: 0.15, X: 0 };

/** Starting guesses: which lines of work are worth contacting. Editable in Settings. */
export const DEFAULT_TIERS = {
  'Hôtel': 'A', "Maison d'hôtes": 'A', "Chambre d'hôtes": 'A', 'Complexe hôtelier': 'A', Hostel: 'A',
  'Agence de voyages': 'A', 'Agence immobilière': 'A', 'Santé': 'A', Restaurant: 'A',
  Services: 'B', Consultant: 'B', 'Crèche': 'B', "Établissement d'enseignement": 'B', 'Université': 'B',
  'Espace de coworking': 'B', 'Siège social': 'B', 'Service de livraison': 'B',
  Autre: 'C', Fabricant: 'C', 'Entreprise de télécommunications': 'C',
  Magasin: 'D', "Magasin d'électronique": 'D'
};

export const DEFAULT_WEIGHTS = { fit: 30, pain: 30, reach: 15, volume: 25 };

export const WEIGHT_INFO = [
  ['fit', 'Category fit', 'How valuable the line of work is (tier A to D).'],
  ['pain', 'Pain', 'No website, a social page only, a free builder site, or a site missing WhatsApp, chat or booking.'],
  ['reach', 'Reach', 'A mobile number scores full, a landline half, none zero.'],
  ['volume', 'Volume', 'More Google reviews usually means more customer messages.']
];

export const CHECKS = [
  ['live', 'Website is live'],
  ['mobile', 'Works on a phone'],
  ['whatsapp', 'WhatsApp button'],
  ['chat', 'Chat widget'],
  ['booking', 'Online booking']
];

const SOCIAL_RX = /(facebook\.com|instagram\.com|linktr\.ee|wa\.me|tiktok\.com|youtube\.com|linkedin\.com|booking\.com|tripadvisor\.|airbnb\.|business\.site|g\.page|goo\.gl|maps\.app)/i;
const BUILDER_RX = /(wixsite\.com|godaddysites|weebly\.com|blogspot\.|wordpress\.com|site123|jimdosite|strikingly|carrd\.co|webnode|mystrikingly)/i;

export const SITE_LABEL = {
  none: 'No website',
  social: 'Social page only',
  builder: 'Free builder site',
  own: 'Own domain'
};

export function siteKind(lead) {
  if (!lead.site_web) return 'none';
  let hostname = '';
  try {
    hostname = new URL(lead.site_web).hostname;
  } catch {
    return 'none';
  }
  if (SOCIAL_RX.test(hostname)) return 'social';
  if (BUILDER_RX.test(hostname)) return 'builder';
  return 'own';
}

/** Moroccan numbers: normalise to 0X..., and work out whether WhatsApp is possible. */
export function phoneInfo(lead) {
  let digits = String(lead.telephone || '').replace(/[^\d+]/g, '');
  if (!digits) return { kind: 'none', text: '', tel: '', wa: '' };
  if (digits.startsWith('+212')) digits = '0' + digits.slice(4);
  else if (digits.startsWith('00212')) digits = '0' + digits.slice(5);
  else if (digits.startsWith('212') && digits.length >= 11) digits = '0' + digits.slice(3);
  const mobile = /^0[67]\d{8}$/.test(digits);
  return {
    kind: mobile ? 'mobile' : 'landline',
    text: lead.telephone,
    tel: digits,
    wa: mobile ? '212' + digits.slice(1) : ''
  };
}

export function tierOf(category, tiers = {}) {
  return tiers[category] || DEFAULT_TIERS[category] || 'B';
}

/** A manual answer on the lead always beats whatever the crawler guessed. */
function checkValue(lead, key) {
  const manual = lead.checks && lead.checks[key];
  if (typeof manual === 'boolean') return manual;
  return null;
}

const PAIN_BASE = { none: 1, social: 0.9, builder: 0.45, own: 0.15 };
const PAIN_EXTRAS = [
  ['mobile', 0.2, 'not mobile friendly'],
  ['whatsapp', 0.3, 'no WhatsApp button'],
  ['chat', 0.2, 'no chat widget'],
  ['booking', 0.15, 'no online booking']
];

/**
 * @returns {{score:number, tier:string, excluded:boolean, siteKind:string, phone:object, parts:Array}}
 */
export function scoreLead(lead, scoring = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...(scoring.weights || {}) };
  const tier = tierOf(lead.categorie, scoring.tiers);
  const kind = siteKind(lead);
  const phone = phoneInfo(lead);
  const total = weights.fit + weights.pain + weights.reach + weights.volume || 1;

  const fit = TIER_VALUE[tier];

  let base = PAIN_BASE[kind];
  let painNote = SITE_LABEL[kind];
  if (checkValue(lead, 'live') === false && kind !== 'none' && kind !== 'social') {
    base = 0.95;
    painNote = 'Website is down';
  } else if (kind === 'own' || kind === 'builder') {
    const missing = [];
    for (const [key, bump, label] of PAIN_EXTRAS) {
      if (checkValue(lead, key) === false) {
        base += bump;
        missing.push(label);
      }
    }
    if (missing.length) painNote += ', ' + missing.join(', ');
    else if (!Object.keys(lead.checks || {}).length) painNote += ' (not checked yet)';
  }
  const pain = Math.min(1, base);

  const reach = phone.kind === 'mobile' ? 1 : phone.kind === 'landline' ? 0.5 : 0;
  const reachNote =
    phone.kind === 'mobile' ? 'Mobile number, can use WhatsApp'
    : phone.kind === 'landline' ? 'Landline only'
    : 'No phone number';

  const reviews = lead.nombre_avis || 0;
  const volume = Math.min(1, Math.log10(reviews + 1) / Math.log10(101));
  const volumeNote = reviews
    ? `${reviews} reviews${lead.note ? ' at ' + Number(lead.note).toFixed(1) : ''} (more reviews, more inbound messages)`
    : 'No reviews yet';

  const parts = [
    { key: 'fit', label: 'Category', fraction: fit, points: (100 * weights.fit * fit) / total, note: `${lead.categorie || 'Unknown'} · ${TIER_LABEL[tier]}` },
    { key: 'pain', label: 'Pain', fraction: pain, points: (100 * weights.pain * pain) / total, note: painNote },
    { key: 'reach', label: 'Reach', fraction: reach, points: (100 * weights.reach * reach) / total, note: reachNote },
    { key: 'volume', label: 'Volume', fraction: volume, points: (100 * weights.volume * volume) / total, note: volumeNote }
  ];

  const score = tier === 'X' ? 0 : Math.round(parts.reduce((sum, p) => sum + p.points, 0));
  return { score, tier, excluded: tier === 'X', siteKind: kind, phone, parts };
}

export const scoreBand = (score) => (score >= 65 ? 'high' : score >= 45 ? 'mid' : 'low');

/** The one-line reason a lead is worth a call today. */
export function topReason(scored) {
  const best = scored.parts.filter((p) => p.key !== 'fit').sort((a, b) => b.points - a.points)[0];
  return best ? best.note : '';
}
