'use strict';
// Google Places API (New) - Place Details. It returns website and phone, never an email address.
const BASE = () => process.env.PLACES_BASE_URL || 'https://places.googleapis.com';
const FIELDS = 'id,displayName,websiteUri,nationalPhoneNumber,internationalPhoneNumber,businessStatus,rating,userRatingCount,googleMapsUri';

async function placeDetails(placeId, apiKey, fetchFn = fetch) {
  const r = await fetchFn(`${BASE()}/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELDS }
  });
  if (!r.ok) {
    let msg = 'Places API HTTP ' + r.status;
    try { const j = await r.json(); if (j.error && j.error.message) msg += ': ' + j.error.message; } catch { /* ignore */ }
    const e = new Error(msg); e.status = r.status; throw e;
  }
  const j = await r.json();
  return { website: j.websiteUri || '', phone: j.nationalPhoneNumber || '', intlPhone: j.internationalPhoneNumber || '', status: j.businessStatus || '', rating: j.rating ?? null, reviews: j.userRatingCount ?? null, maps: j.googleMapsUri || '' };
}

/** Copy useful facts onto the lead. Never overwrites something already filled in. */
function applyDetails(lead, d) {
  const changes = [];
  if (!lead.site_web && d.website) { lead.site_web = d.website; changes.push('website'); }
  if (!lead.telephone && d.phone) { lead.telephone = d.phone; changes.push('phone'); }
  if (d.status) lead.placesStatus = d.status;
  if (d.rating != null && lead.note == null) { lead.note = d.rating; changes.push('rating'); }
  if (d.reviews != null && lead.nombre_avis == null) { lead.nombre_avis = d.reviews; changes.push('reviews'); }
  lead.placesCheckedAt = new Date().toISOString();
  return changes;
}
module.exports = { placeDetails, applyDetails };
