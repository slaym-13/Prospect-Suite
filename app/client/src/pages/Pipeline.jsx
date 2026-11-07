import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useApp } from '../store/AppContext';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Field';
import { Message, Spinner } from '../components/ui/Feedback';
import { ScorePill } from '../components/ui/Pill';
import { LeadDrawer } from '../features/lead/LeadDrawer';
import { STATUS_LABEL, shortDate, today } from '../lib/format';
import { cn } from '../lib/cn';

const COLUMNS = ['new', 'contacted', 'replied', 'meeting', 'won', 'lost'];
/** A column shows its best leads only; the full list lives on Companies. */
const PER_COLUMN = 40;

/** Board view of the pipeline. Drag a card, or use the menu on it (which also works on a phone). */
export default function Pipeline() {
  const { leads, loading, error, mergeLead, toast } = useApp();
  const [openId, setOpenId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const byStatus = useMemo(() => {
    const groups = Object.fromEntries(COLUMNS.map((s) => [s, []]));
    for (const lead of leads) if (groups[lead.status]) groups[lead.status].push(lead);
    for (const list of Object.values(groups)) list.sort((a, b) => b.score - a.score);
    return groups;
  }, [leads]);

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

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="mt-1 max-w-[62ch] text-muted">
          Drag a company to another column, or change its stage on the card.
        </p>
      </div>

      <div className="flex items-start gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((status) => (
          <div
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
              'flex w-65 shrink-0 flex-col gap-2 rounded-card bg-surface-2 p-2.5',
              dragOver === status && 'outline-2 outline-dashed outline-accent'
            )}
          >
            <h2 className="flex items-baseline justify-between text-[15px] font-semibold tracking-tight">
              {STATUS_LABEL[status]}
              <span className="text-xs font-medium text-muted tabular-nums">{byStatus[status].length}</span>
            </h2>

            {byStatus[status].slice(0, PER_COLUMN).map((lead) => (
              <article
                key={lead.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', lead.id)}
                className="flex w-full min-w-0 cursor-grab flex-col gap-1 rounded-xl border border-line bg-surface p-2.5 active:cursor-grabbing"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenId(lead.id)}
                    className="min-w-0 flex-1 truncate text-left font-semibold hover:text-accent"
                  >
                    {lead.nom}
                  </button>
                  <ScorePill score={lead.score} excluded={lead.excluded} />
                </div>
                {lead.nextStep && (
                  <p className={cn('m-0 text-xs', lead.nextStep <= now ? 'font-semibold text-bad' : 'text-muted')}>
                    Next: {shortDate(lead.nextStep)}
                  </p>
                )}
                <Select
                  aria-label={`Stage for ${lead.nom}`}
                  className="py-1 text-[12.5px]"
                  value={lead.status}
                  onChange={(e) => move(lead.id, e.target.value)}
                >
                  {COLUMNS.concat('optout').map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </article>
            ))}

            {!byStatus[status].length && <p className="px-1 text-[13px] text-muted">Empty</p>}
            {byStatus[status].length > PER_COLUMN && (
              <p className="px-1 text-[13px] text-muted">
                + {byStatus[status].length - PER_COLUMN} more, highest score first
              </p>
            )}
          </div>
        ))}
      </div>

      {openId && <LeadDrawer leadId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
