import { Button } from '../../components/ui/Button';
import { Pill, ScorePill } from '../../components/ui/Pill';
import { ContactActions } from './ContactActions';
import { SITE_LABEL } from '../../lib/scoring';

/** A company as a card: used on Today and on the pipeline board. */
export function LeadCard({ lead, reason, onOpen, actions }) {
  return (
    <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-card border border-line bg-surface p-3 shadow-card">
      <div className="min-w-0">
        <button
          type="button"
          onClick={onOpen}
          className="block max-w-full truncate text-left font-semibold hover:text-accent"
        >
          {lead.nom}
        </button>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
          <span>{lead.categorie}</span>
          {lead.siteKind === 'none' && <Pill tone="bad">No website</Pill>}
          {lead.siteKind === 'social' && <Pill tone="warn">Social only</Pill>}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <ScorePill score={lead.score} excluded={lead.excluded} />
        {lead.star && <span className="text-warn">★</span>}
      </div>

      {reason && reason !== SITE_LABEL[lead.siteKind] && (
        <p className="col-span-full m-0 text-[12.5px] text-muted">{reason}</p>
      )}

      <div className="col-span-full flex flex-wrap items-center gap-1.5">
        {lead.phone.text && <span className="text-sm tabular-nums">{lead.phone.text}</span>}
        <ContactActions lead={lead} scored={lead} />
        {actions}
      </div>
    </article>
  );
}

export { SITE_LABEL };
