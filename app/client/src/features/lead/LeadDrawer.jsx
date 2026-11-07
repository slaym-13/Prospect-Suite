import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useApp } from '../../store/AppContext';
import { scoreLead } from '../../lib/scoring';
import { STATUS_LABEL, hostname, safeUrl } from '../../lib/format';
import { Drawer, DrawerSection } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { Select, Textarea } from '../../components/ui/Field';
import { Message, Spinner } from '../../components/ui/Feedback';
import { Pill } from '../../components/ui/Pill';
import { ContactActions } from './ContactActions';
import { ScoreBreakdown } from './ScoreBreakdown';
import { DraftComposer } from './DraftComposer';
import { ContactLog } from './ContactLog';
import { WebsiteChecks } from './WebsiteChecks';
import { PipelinePanel } from './PipelinePanel';

/**
 * Everything about one company. Loads the full lead (the list only holds a
 * summary), then hands slices of it to the panels below.
 */
export function LeadDrawer({ leadId, onClose }) {
  const { config, settings, mergeLead, toast } = useApp();
  const [lead, setLead] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLead(null);
    setError('');
    api
      .lead(leadId)
      .then((l) => active && setLead(l))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [leadId]);

  /** Every panel reports back here, so the drawer and the cached list stay in step. */
  const update = useCallback(
    (fresh) => {
      setLead(fresh);
      mergeLead(fresh);
    },
    [mergeLead]
  );

  const patch = useCallback(
    async (body, successMessage) => {
      try {
        update(await api.patchLead(leadId, body));
        if (successMessage) toast(successMessage);
      } catch (e) {
        toast(e.message, 'bad');
      }
    },
    [leadId, update, toast]
  );

  const scored = lead ? scoreLead(lead, settings?.scoring) : null;

  return (
    <Drawer
      open
      onClose={onClose}
      title={lead?.nom || 'Loading…'}
      badge={
        lead && (
          <>
            <Pill>{lead.categorie || 'Uncategorised'}</Pill>
            <Button
              size="sm"
              variant="ghost"
              aria-pressed={!!lead.star}
              onClick={() => patch({ star: !lead.star })}
              title={lead.star ? 'Remove star' : 'Star this company'}
            >
              <span className={lead.star ? 'text-warn' : 'text-muted'}>{lead.star ? '★' : '☆'}</span>
            </Button>
          </>
        )
      }
    >
      {error && <Message tone="bad">{error}</Message>}
      {!lead && !error && <Spinner />}

      {lead && (
        <>
          <DrawerSection title="Details">
            <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-2.5 gap-y-1 text-[13.5px]">
              <dt className="text-muted">Status</dt>
              <dd className="m-0">
                <Select
                  className="w-auto py-1"
                  aria-label="Status"
                  value={lead.status}
                  onChange={(e) => patch({ status: e.target.value }, 'Status saved')}
                >
                  {config.statuses.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </dd>
              <dt className="text-muted">Address</dt>
              <dd className="m-0 break-words">{lead.adresse || '—'}</dd>
              <dt className="text-muted">Phone</dt>
              <dd className="m-0">{lead.telephone || '—'}</dd>
              <dt className="text-muted">Email</dt>
              <dd className="m-0 break-all">
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="text-accent">
                    {lead.email}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
              <dt className="text-muted">Website</dt>
              <dd className="m-0 break-words">
                {safeUrl(lead.site_web) ? (
                  <a href={safeUrl(lead.site_web)} target="_blank" rel="noopener noreferrer" className="text-accent">
                    {hostname(lead.site_web)}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
              <dt className="text-muted">Google</dt>
              <dd className="m-0">{lead.note ? `${lead.note} stars, ${lead.nombre_avis || 0} reviews` : '—'}</dd>
            </dl>
            <ContactActions lead={lead} scored={scored} />
            {config.places && (
              <div>
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      const r = await api.placesLookup(leadId);
                      update(r.lead);
                      toast(r.changes.length ? `Updated: ${r.changes.join(', ')}` : 'Nothing new on Google');
                    } catch (e) {
                      toast(e.message, 'bad');
                    }
                  }}
                >
                  Refresh website &amp; phone from Google Places
                </Button>
              </div>
            )}
          </DrawerSection>

          <ScoreBreakdown scored={scored} />
          <PipelinePanel lead={lead} onPatch={patch} />
          <DraftComposer lead={lead} onUpdate={update} />
          <ContactLog lead={lead} onUpdate={update} />
          <WebsiteChecks lead={lead} onPatch={patch} />

          <DrawerSection title="Notes">
            <NotesBox lead={lead} onPatch={patch} />
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
}

function NotesBox({ lead, onPatch }) {
  const [value, setValue] = useState(lead.notes || '');
  useEffect(() => setValue(lead.notes || ''), [lead.id, lead.notes]);
  return (
    <>
      <Textarea rows={3} aria-label="Notes" placeholder="Private notes…" value={value} onChange={(e) => setValue(e.target.value)} />
      <div>
        <Button size="sm" onClick={() => onPatch({ notes: value }, 'Notes saved')}>
          Save notes
        </Button>
      </div>
    </>
  );
}
