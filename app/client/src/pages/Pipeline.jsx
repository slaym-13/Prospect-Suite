import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useApp } from '../store/AppContext';
import { Input, Select } from '../components/ui/Field';
import { Message, Spinner } from '../components/ui/Feedback';
import { Pill, ScorePill } from '../components/ui/Pill';
import { LeadDrawer } from '../features/lead/LeadDrawer';
import { STATUS_LABEL, nf, shortDate, today } from '../lib/format';
import { cn } from '../lib/cn';

const COLUMNS = ['new', 'contacted', 'replied', 'meeting', 'won', 'lost'];
const ALL_STAGES = [...COLUMNS, 'optout'];

/** Rendering 283 cards at once is pointless; each column pages in more on demand. */
const PAGE = 25;

/** A dot per column, so the eye can tell the stages apart while scrolling sideways. */
const DOT = {
  new: 'bg-neutral',
  contacted: 'bg-accent',
  replied: 'bg-accent',
  meeting: 'bg-accent',
  won: 'bg-good',
  lost: 'bg-bad'
};

function Card({ lead, now, onOpen, onMove }) {
  const late = lead.nextStep && lead.nextStep <= now;
  return (
    <article
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', lead.id)}
      className="grid w-full min-w-0 shrink-0 cursor-grab gap-1 overflow-hidden rounded-xl border border-line bg-surface px-2.5 py-2 shadow-card active:cursor-grabbing"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 truncate text-left text-sm font-semibold hover:text-accent"
          title={lead.nom}
        >
          {lead.nom}
        </button>
        <ScorePill score={lead.score} excluded={lead.excluded} />
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {lead.nextStep && (
          <Pill tone={late ? 'bad' : 'neutral'}>{late ? 'Due ' : ''}{shortDate(lead.nextStep)}</Pill>
        )}
        {!lead.email && <Pill tone="warn">No email</Pill>}
        {lead.star && <span className="text-sm text-warn">★</span>}

        {/* Dragging does not work on a touch screen, so every card keeps a menu. */}
        <Select
          aria-label={`Stage for ${lead.nom}`}
          className="ml-auto w-auto! border-transparent bg-transparent py-0 pl-1 pr-0 text-xs text-muted hover:text-accent"
          value={lead.status}
          onChange={(e) => onMove(lead.id, e.target.value)}
        >
          {ALL_STAGES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>
    </article>
  );
}

/** Kanban board. Each column scrolls on its own, so the board stays one screen tall. */
export default function Pipeline() {
  const { leads, loading, error, mergeLead, toast } = useApp();
  const [openId, setOpenId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(() => Object.fromEntries(COLUMNS.map((s) => [s, PAGE])));

  const byStatus = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = Object.fromEntries(COLUMNS.map((s) => [s, []]));
    for (const lead of leads) {
      if (!groups[lead.status]) continue;
      if (q && !`${lead.nom} ${lead.categorie}`.toLowerCase().includes(q)) continue;
      groups[lead.status].push(lead);
    }
    // Follow-ups that are already due float to the top, then the best score.
    const now = today();
    for (const list of Object.values(groups)) {
      list.sort((a, b) => {
        const aDue = a.nextStep && a.nextStep <= now ? 0 : 1;
        const bDue = b.nextStep && b.nextStep <= now ? 0 : 1;
        return aDue - bDue || b.score - a.score;
      });
    }
    return groups;
  }, [leads, query]);

  async function move(id, status) {
    try {
      mergeLead(await api.patchLead(id, { status }));
    } catch (e) {
      toast(e.message, 'bad');
    }
  }

  if (loading) return <Spinner />;
  if (error) return <Message tone="bad">{error}</Message>;

  const now = today();
  const total = COLUMNS.reduce((n, s) => n + byStatus[s].length, 0);
  const dueTotal = COLUMNS.reduce(
    (n, s) => n + byStatus[s].filter((l) => l.nextStep && l.nextStep <= now).length, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="mt-1 text-muted">
            {nf(total)} companies · drag a card between columns, or use the menu on it
            {dueTotal > 0 && <> · <span className="font-semibold text-bad">{dueTotal} due today</span></>}
          </p>
        </div>
        <Input
          type="search"
          placeholder="Filter the board…"
          aria-label="Filter the board"
          className="w-60"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Horizontal scroll: six fixed-width columns, wider than any laptop screen. */}
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3">
        {COLUMNS.map((status) => {
          const list = byStatus[status];
          const limit = shown[status];
          return (
            <section
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(status);
              }}
              onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData('text/plain');
                if (id) move(id, status);
              }}
              className={cn(
                'flex w-70 shrink-0 snap-start flex-col rounded-card bg-surface-2',
                dragOver === status && 'outline-2 outline-dashed outline-accent'
              )}
            >
              <h2 className="flex items-center gap-2 px-3 py-2.5 text-[15px] font-semibold tracking-tight">
                <span className={cn('size-2 shrink-0 rounded-full', DOT[status])} aria-hidden="true" />
                <span className="truncate">{STATUS_LABEL[status]}</span>
                <span className="ml-auto text-xs font-medium tabular-nums text-muted">{list.length}</span>
              </h2>

              {/* Each column scrolls by itself: the page never grows past one screen. */}
              <div className="flex max-h-[calc(100vh-19rem)] min-h-30 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
                {list.slice(0, limit).map((lead) => (
                  <Card
                    key={lead.id}
                    lead={lead}
                    now={now}
                    onOpen={() => setOpenId(lead.id)}
                    onMove={move}
                  />
                ))}

                {!list.length && (
                  <p className="px-1 py-2 text-[13px] text-muted">
                    {query ? 'Nothing matches here.' : 'Empty — drop a company in.'}
                  </p>
                )}

                {list.length > limit && (
                  <button
                    type="button"
                    onClick={() => setShown((s) => ({ ...s, [status]: s[status] + PAGE }))}
                    className="rounded-xl border border-dashed border-line py-2 text-[13px] text-muted hover:border-accent hover:text-accent"
                  >
                    Show {Math.min(PAGE, list.length - limit)} more of {list.length - limit}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {openId && <LeadDrawer leadId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
