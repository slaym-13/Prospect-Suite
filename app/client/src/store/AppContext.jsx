import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { scoreLead } from '../lib/scoring';

const AppContext = createContext(null);

/**
 * One place for everything the whole app reads: the signed-in user, the lead
 * list, settings, the running background job and toasts. Pages read it with
 * useApp(); nothing else fetches these on its own.
 */
export function AppProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [leads, setLeads] = useState([]);
  const [settings, setSettings] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3500);
  }, []);

  const loadLeads = useCallback(async () => setLeads(await api.leads()), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, list, s] = await Promise.all([api.config(), api.leads(), api.getSettings()]);
      setConfig(cfg);
      setLeads(list);
      setSettings(s);
      setError(null);
    } catch (e) {
      if (e.status !== 401) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Merge one lead's fresh fields into the cached list without refetching everything. */
  const mergeLead = useCallback((lead) => {
    setLeads((list) =>
      list.map((l) => {
        if (l.id !== lead.id) return l;
        return {
          ...l,
          nom: lead.nom, telephone: lead.telephone, site_web: lead.site_web,
          status: lead.status, email: lead.email,
          nextStep: lead.nextStep || '', star: !!lead.star, snooze: lead.snooze || '',
          checks: lead.checks || {}, logCount: (lead.log || []).length, lastLog: (lead.log || [])[0] || null,
          hasNotes: !!lead.notes,
          sentLog: (lead.sent || []).map((s) => ({ at: s.at, ok: s.ok }))
        };
      })
    );
  }, []);

  /* ----- background jobs: poll while one runs, reload leads when it ends ----- */
  const timerRef = useRef(null);
  const pollJob = useCallback(
    async function poll() {
      clearTimeout(timerRef.current);
      try {
        const current = await api.currentJob();
        setJob((previous) => {
          if (previous?.running && !current.running) loadLeads();
          return current.id ? current : null;
        });
        if (current.running) timerRef.current = setTimeout(poll, 1500);
      } catch {
        /* a failed poll is not worth showing; the next one may work */
      }
    },
    [loadLeads]
  );

  useEffect(() => {
    pollJob();
    return () => clearTimeout(timerRef.current);
  }, [pollJob]);

  const startJob = useCallback(
    async (type, scope) => {
      try {
        const started = await api.startJob(type, scope);
        setJob(started);
        toast(started.total ? `Started: ${started.total} companies` : 'Nothing to do');
        pollJob();
      } catch (e) {
        toast(e.message, 'bad');
      }
    },
    [pollJob, toast]
  );

  const cancelJob = useCallback(async () => {
    await api.cancelJob();
    pollJob();
  }, [pollJob]);

  const saveSettings = useCallback(async (next) => {
    const saved = await api.saveSettings(next);
    setSettings(saved);
    return saved;
  }, []);

  /* Scores change whenever a lead or the weights change, so derive them once here. */
  const scoring = settings?.scoring;
  const scored = useMemo(
    () => leads.map((lead) => ({ ...lead, ...scoreLead(lead, scoring) })),
    [leads, scoring]
  );

  const value = useMemo(
    () => ({
      config, settings, leads: scored, rawLeads: leads, loading, error, job, toasts,
      refresh, loadLeads, mergeLead, startJob, cancelJob, saveSettings, toast, dismissJob: () => setJob(null)
    }),
    [config, settings, scored, leads, loading, error, job, toasts, refresh, loadLeads, mergeLead, startJob, cancelJob, saveSettings, toast]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
