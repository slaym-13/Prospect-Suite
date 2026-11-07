import { useState } from 'react';
import { api } from '../../lib/api';
import { DrawerSection } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { Message } from '../../components/ui/Feedback';
import { addDays, shortDate } from '../../lib/format';

/** Outcome -> the status it moves the company to, and a sensible follow-up gap in days. */
export const OUTCOMES = [
  ['no_answer', 'No answer', 2],
  ['callback', 'Call back later', 3],
  ['interested', 'Interested', 2],
  ['demo', 'Demo or meeting set', 0],
  ['not_interested', 'Not interested', 0],
  ['wrong', 'Wrong number or closed', 0],
  ['won', 'Won', 0]
];

const VIA = ['Call', 'WhatsApp', 'Instagram DM', 'Visit', 'Email'];
const OUTCOME_LABEL = Object.fromEntries(OUTCOMES.map(([k, label]) => [k, label]));

/** Record a call or a visit. Logging moves the company along the pipeline. */
export function ContactLog({ lead, onUpdate }) {
  const [form, setForm] = useState({ via: 'Call', outcome: 'no_answer', note: '', nextStep: addDays(2) });
  const [error, setError] = useState('');

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      if (key !== 'outcome') return { ...f, [key]: value };
      const days = OUTCOMES.find(([k]) => k === value)?.[2] ?? 0;
      return { ...f, outcome: value, nextStep: days ? addDays(days) : '' };
    });
  };

  async function save() {
    setError('');
    try {
      onUpdate(await api.addLog(lead.id, form));
      setForm((f) => ({ ...f, note: '' }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(index) {
    try {
      onUpdate(await api.removeLog(lead.id, index));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <DrawerSection title="Log a contact">
      {error && <Message tone="bad">{error}</Message>}

      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        <Field label="How">
          <Select value={form.via} onChange={set('via')}>
            {VIA.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Outcome">
          <Select value={form.outcome} onChange={set('outcome')}>
            {OUTCOMES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Next step on">
          <Input type="date" value={form.nextStep} onChange={set('nextStep')} />
        </Field>
      </div>

      <Textarea rows={2} placeholder="What was said…" aria-label="Note" value={form.note} onChange={set('note')} />
      <div>
        <Button variant="primary" size="sm" onClick={save}>
          Save contact
        </Button>
      </div>

      {!!(lead.log || []).length && (
        <ul className="grid gap-2.5 text-[13px]">
          {lead.log.map((entry, i) => (
            <li key={`${entry.at}-${i}`} className="flex items-start gap-2 border-l-2 border-line pl-2.5">
              <div className="flex-1">
                <b className="font-semibold">{OUTCOME_LABEL[entry.outcome] || entry.outcome}</b>{' '}
                <span className="text-muted">
                  · {entry.via} · {shortDate(entry.at)}
                </span>
                {entry.note && <div className="text-muted">{entry.note}</div>}
              </div>
              <Button size="sm" variant="ghost" aria-label="Delete entry" onClick={() => remove(i)}>
                ✕
              </Button>
            </li>
          ))}
        </ul>
      )}
    </DrawerSection>
  );
}
