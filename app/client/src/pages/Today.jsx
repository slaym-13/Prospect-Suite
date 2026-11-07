import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useApp } from '../store/AppContext';
import { Button } from '../components/ui/Button';
import { Empty, Message, Spinner } from '../components/ui/Feedback';
import { KpiRow, Kpi } from '../components/ui/Kpi';
import { LeadCard } from '../features/lead/LeadCard';
import { LeadDrawer } from '../features/lead/LeadDrawer';
import { topReason } from '../lib/scoring';
import { addDays, shortDate, today } from '../lib/format';

const OUTCOME_LABEL = {
  no_answer: 'No answer',
  callback: 'Call back later',
  interested: 'Interested',
  demo: 'Demo or meeting set',
  not_interested: 'Not interested',
  wrong: 'Wrong number or closed',
  won: 'Won'
};

function lastContact(lead) {
  if (!lead.lastLog) return 'No contact logged yet.';
  const { outcome, at, note } = lead.lastLog;
  return `${OUTCOME_LABEL[outcome] || outcome} on ${shortDate(at)}${note ? `: ${note.slice(0, 80)}` : ''}`;
}

/** The day's work: follow-ups that are due, then the best untouched leads. */
export default function Today() {
  const { leads, settings, loading, error, mergeLead, toast } = useApp();
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState(null);

  const perDay = settings?.scoring?.perDay || 5;
  const now = today();

  const { due, noNextStep, pool, inPlay, loggedThisWeek, won } = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const due = [];
    const noNextStep = [];
    let inPlay = 0;
    let loggedThisWeek = 0;
    let won = 0;

    for (const lead of leads) {
      if (lead.status === 'won') won++;
      if (['contacted', 'replied', 'meeting'].includes(lead.status)) {
        inPlay++;
        if (!lead.nextStep) noNextStep.push(lead);
      }
      if (lead.lastLog && lead.lastLog.at >= weekAgo) loggedThisWeek++;
      if (lead.nextStep && lead.nextStep <= now && !['won', 'lost', 'optout'].includes(lead.status)) due.push(lead);
    }

    due.sort((a, b) => (a.nextStep < b.nextStep ? -1 : a.nextStep > b.nextStep ? 1 : b.score - a.score));

    const pool = leads
      .filter((l) => l.status === 'new' && !l.excluded && !(l.snooze && l.snooze > now))
      .sort((a, b) => b.score - a.score);

    return { due, noNextStep, pool, inPlay, loggedThisWeek, won };
  }, [leads, now]);

  async function snooze(lead) {
    try {
      mergeLead(await api.patchLead(lead.id, { snooze: addDays(7) }));
      toast(`${lead.nom} hidden for 7 days`);
    } catch (e) {
      toast(e.message, 'bad');
    }
  }

  if (loading) return <Spinner />;
  if (error) return <Message tone="bad">{error}</Message>;

  const start = pool.slice(offset, offset + perDay);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="mt-1 max-w-[62ch] text-muted">
          Follow-ups come first, then the best new leads by fit score. Log each contact so the next step is never lost.
        </p>
      </div>

      <KpiRow>
        <Kpi label="Follow-ups due" value={due.length} />
        <Kpi label="In conversation" value={inPlay} />
        <Kpi label="Contacts logged, 7 days" value={loggedThisWeek} />
        <Kpi label="Won" value={won} />
      </KpiRow>

      <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
        <section>
          <div className="mb-2.5 flex items-baseline gap-2.5">
            <h2 className="text-lg font-semibold tracking-tight">Follow-ups due</h2>
            <span className="text-xs text-muted tabular-nums">{due.length}</span>
          </div>
          {due.length ? (
            <div className="grid gap-2">
              {due.map((lead) => (
                <LeadCard key={lead.id} lead={lead} reason={lastContact(lead)} onOpen={() => setOpenId(lead.id)} />
              ))}
            </div>
          ) : (
            <Empty>Nothing due. Log a contact with a next date and it will show up here.</Empty>
          )}

          {!!noNextStep.length && (
            <>
              <div className="mb-2.5 mt-5 flex items-baseline gap-2.5">
                <h2 className="text-lg font-semibold tracking-tight">Needs a next step</h2>
                <span className="text-xs text-muted tabular-nums">{noNextStep.length}</span>
              </div>
              <div className="grid gap-2">
                {noNextStep.slice(0, 8).map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    reason="In conversation with no follow-up date."
                    onOpen={() => setOpenId(lead.id)}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <section>
          <div className="mb-2.5 flex flex-wrap items-baseline gap-2.5">
            <h2 className="text-lg font-semibold tracking-tight">Start with</h2>
            <span className="text-xs text-muted tabular-nums">
              {start.length} of {pool.length} new leads
            </span>
            <span className="ml-auto flex gap-1.5">
              {offset > 0 && (
                <Button size="sm" onClick={() => setOffset((o) => Math.max(0, o - perDay))}>
                  Back
                </Button>
              )}
              {pool.length > offset + perDay && (
                <Button size="sm" onClick={() => setOffset((o) => o + perDay)}>
                  Next {perDay}
                </Button>
              )}
            </span>
          </div>
          {start.length ? (
            <div className="grid gap-2">
              {start.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  reason={topReason(lead)}
                  onOpen={() => setOpenId(lead.id)}
                  actions={
                    <Button size="sm" variant="ghost" onClick={() => snooze(lead)}>
                      Skip 7 days
                    </Button>
                  }
                />
              ))}
            </div>
          ) : (
            <Empty>No new leads left. Check the category tiers in Settings.</Empty>
          )}
        </section>
      </div>

      {openId && <LeadDrawer leadId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
