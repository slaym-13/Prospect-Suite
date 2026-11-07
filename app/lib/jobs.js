'use strict';
// One background job at a time (email search or Places refresh), with progress for the UI.
let job = { id: 0, type: '', running: false, total: 0, done: 0, found: 0, failed: 0, message: '', startedAt: null, finishedAt: null, cancel: false };

function current() { const { cancel, ...pub } = job; return pub; }
function cancel() { if (job.running) job.cancel = true; return current(); }

async function start(type, items, worker, { concurrency = 3, pauseMs = 150 } = {}) {
  if (job.running) throw Object.assign(new Error('A job is already running.'), { code: 'BUSY' });
  job = { id: job.id + 1, type, running: true, total: items.length, done: 0, found: 0, failed: 0, message: '', startedAt: new Date().toISOString(), finishedAt: null, cancel: false };
  const mine = job;
  let i = 0;
  const lane = async () => {
    while (i < items.length && !mine.cancel) {
      const item = items[i++];
      try { const r = await worker(item); if (r && r.found) mine.found++; if (r && r.failed) mine.failed++; }
      catch (e) { mine.failed++; mine.message = String(e.message || e).slice(0, 160); }
      mine.done++;
      if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
    }
  };
  // fire and forget; the UI polls current()
  Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, lane)).finally(() => { mine.running = false; mine.finishedAt = new Date().toISOString(); if (mine.cancel) mine.message = 'Stopped.'; });
  return current();
}
module.exports = { start, current, cancel };
