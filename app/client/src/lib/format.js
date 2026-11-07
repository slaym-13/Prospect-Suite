const numberFormat = new Intl.NumberFormat('en-US');

export const nf = (n) => numberFormat.format(n || 0);
export const pct = (part, whole) => (whole ? Math.round((100 * part) / whole) + '%' : '0%');

const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoDate(new Date());

export function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** "12 Mar" for a date-only string, or a full timestamp. */
export function shortDate(value) {
  if (!value) return '';
  const d = new Date(value.length === 10 ? value + 'T12:00:00' : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function dateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export const STATUS_LABEL = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  meeting: 'Meeting',
  won: 'Won',
  lost: 'Lost',
  optout: 'Do not contact'
};

/** Pill tone per status, so the colour of a status is decided in one place. */
export const STATUS_TONE = {
  new: 'neutral',
  contacted: 'info',
  replied: 'info',
  meeting: 'info',
  won: 'good',
  lost: 'bad',
  optout: 'bad'
};

export function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Only ever produce links we are happy to hand to the browser. */
export function safeUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}
