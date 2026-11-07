import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useApp } from '../../store/AppContext';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Drawer, DrawerSection } from '../../components/ui/Drawer';
import { Message } from '../../components/ui/Feedback';
import { nf } from '../../lib/format';

const FIELDS = [
  ['nom', 'Company name', 'text'],
  ['categorie', 'Category', 'text'],
  ['adresse', 'Address', 'text'],
  ['telephone', 'Phone', 'text'],
  ['email', 'Email', 'email'],
  ['site_web', 'Website', 'url'],
  ['note', 'Google rating', 'number'],
  ['nombre_avis', 'Review count', 'number'],
  ['google_maps', 'Google Maps link', 'url']
];

const empty = () => Object.fromEntries(FIELDS.map(([k]) => [k, '']));

/** Add or correct one company. Used for both, so the two stay consistent. */
function RecordEditor({ lead, onClose, onSaved }) {
  const isNew = !lead.id;
  const [form, setForm] = useState(() => ({
    ...empty(),
    ...Object.fromEntries(FIELDS.map(([k]) => [k, lead[k] == null ? '' : String(lead[k])]))
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setError('');
    setBusy(true);
    try {
      const saved = isNew ? await api.adminCreateLead(form) : await api.adminUpdateLead(lead.id, form);
      onSaved(saved, isNew);
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Drawer open onClose={onClose} title={isNew ? 'New company' : lead.nom}>
      {error && <Message tone="bad">{error}</Message>}
      <DrawerSection title="Record">
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
          {FIELDS.map(([key, label, type]) => (
            <Field key={key} label={label} className={key === 'adresse' || key === 'google_maps' ? 'col-span-full' : ''}>
              <Input
                type={type === 'number' ? 'number' : 'text'}
                step={key === 'note' ? '0.1' : undefined}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Create company' : 'Save changes'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
        {!isNew && (
          <p className="m-0 text-[12.5px] text-muted">
            Identifier <span className="break-all">{lead.id}</span>. Statuses, notes and the contact log are
            edited from the Companies page.
          </p>
        )}
      </DrawerSection>
    </Drawer>
  );
}

/** The company records themselves: add, correct, delete, or reload the dataset. */
export function DataCard() {
  const { leads, loadLeads, toast } = useApp();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? leads.filter((l) => `${l.nom} ${l.categorie} ${l.email}`.toLowerCase().includes(q))
      : leads;
    return list.slice(0, 40);
  }, [leads, query]);

  async function remove(lead) {
    if (!window.confirm(`Delete ${lead.nom}? Its notes and contact history go with it.`)) return;
    setError('');
    setBusy(true);
    try {
      await api.adminDeleteLead(lead.id);
      await loadLeads();
      toast(`${lead.nom} deleted`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetAll() {
    if (!window.confirm('Reload the dataset?\n\nEvery company, status, note and contact log is deleted and the 283 companies that ship with the app are loaded again. This cannot be undone.')) return;
    setError('');
    setBusy(true);
    try {
      const r = await api.adminReset();
      await loadLeads();
      toast(`Dataset reloaded: ${r.added} companies`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Company records"
          subtitle="Correct the underlying data. Statuses and notes stay on the Companies page."
          action={
            <Button variant="primary" size="sm" onClick={() => setEditing(empty())}>
              Add a company
            </Button>
          }
        />
        {error && <Message tone="bad" className="mb-3">{error}</Message>}

        <Input
          type="search"
          placeholder="Search the records…"
          aria-label="Search the records"
          className="mb-3"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="max-h-120 overflow-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {['Company', 'Category', 'Phone', 'Email', ''].map((h) => (
                  <th key={h} className="sticky top-0 border-b border-line bg-surface px-3 py-2 text-left text-xs font-semibold text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => (
                <tr key={lead.id} className="border-b border-line last:border-0">
                  <td className="max-w-64 truncate px-3 py-1.5 font-medium" title={lead.nom}>{lead.nom}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-muted">{lead.categorie || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-muted">{lead.telephone || '—'}</td>
                  <td className="max-w-56 truncate px-3 py-1.5 text-muted">{lead.email || '—'}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" onClick={() => setEditing(lead)}>Edit</Button>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => remove(lead)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted">No company matches.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-[12.5px] text-muted">
          {nf(leads.length)} companies in total{rows.length < leads.length && `, showing the first ${rows.length}`}.
        </p>
      </Card>

      <Card className="border-bad/30">
        <CardHeader
          title="Reload the dataset"
          subtitle="Deletes every company, status, note and contact log, then loads the 283 companies that ship with the app."
        />
        <Button variant="danger" onClick={resetAll} disabled={busy}>
          {busy ? 'Working…' : 'Delete everything and reload'}
        </Button>
      </Card>

      {editing && (
        <RecordEditor
          lead={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            loadLeads();
            toast(isNew ? `${saved.nom} created` : 'Record saved');
          }}
        />
      )}
    </>
  );
}
