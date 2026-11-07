import { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { Message, Spinner } from '../components/ui/Feedback';
import { DEFAULT_WEIGHTS, TIERS, TIER_LABEL, WEIGHT_INFO, tierOf } from '../lib/scoring';
import { AiKeyCard } from '../features/settings/AiKeyCard';

/** Sender identity, sending limits and the scoring weights, all saved to the server. */
export default function Settings() {
  const { settings, saveSettings, leads, loading, error } = useApp();
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  // Seed the form from the saved settings the first time they arrive.
  const state = form ?? settings;
  const categories = useMemo(() => [...new Set(leads.map((l) => l.categorie).filter(Boolean))].sort(), [leads]);

  if (loading || !state) return <Spinner />;
  if (error) return <Message tone="bad">{error}</Message>;

  const edit = (patch) => setForm({ ...state, ...patch });
  const editSender = (patch) => edit({ sender: { ...state.sender, ...patch } });
  const editScoring = (patch) => edit({ scoring: { ...state.scoring, ...patch } });

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await saveSettings(state);
      setForm(null);
      setMessage({ tone: 'good', text: 'Saved.' });
    } catch (err) {
      setMessage({ tone: 'bad', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const weightTotal = Object.values(state.scoring.weights).reduce((a, b) => a + b, 0) || 1;

  return (
    <>
      <AiKeyCard />

      <form onSubmit={onSubmit} className="grid gap-4">
        <Card>
          <CardHeader
            title="Sender & outreach"
            subtitle="Used by the AI and added to every email. The opt-out line is always appended."
          />
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
            <Field label="Your name">
              <Input value={state.sender.name} onChange={(e) => editSender({ name: e.target.value })} />
            </Field>
            <Field label='Who you are (e.g. "3rd-year engineering student, ENSA Marrakech")'>
              <Input value={state.sender.role} onChange={(e) => editSender({ role: e.target.value })} />
            </Field>
            <Field label="Short background the AI may use (skills, projects)" className="col-span-full">
              <Textarea rows={4} value={state.sender.background} onChange={(e) => editSender({ background: e.target.value })} />
            </Field>

            <Field label="Default goal">
              <Select value={state.goal} onChange={(e) => edit({ goal: e.target.value })}>
                <option value="internship">Internship request</option>
                <option value="pitch">Service pitch</option>
              </Select>
            </Field>
            <Field label="Default language">
              <Select value={state.language} onChange={(e) => edit({ language: e.target.value })}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </Select>
            </Field>
            <Field label='Period / availability (e.g. "July–August 2027")'>
              <Input value={state.period} onChange={(e) => edit({ period: e.target.value })} />
            </Field>
            <Field label="Reply-to address">
              <Input type="email" value={state.replyTo} onChange={(e) => edit({ replyTo: e.target.value })} />
            </Field>

            <Field label="Signature" className="col-span-full">
              <Textarea rows={3} value={state.signature} onChange={(e) => edit({ signature: e.target.value })} />
            </Field>
            <Field label="Opt-out line (Français)" className="col-span-full">
              <Textarea
                rows={2}
                value={state.optOut.fr}
                onChange={(e) => edit({ optOut: { ...state.optOut, fr: e.target.value } })}
              />
            </Field>
            <Field label="Opt-out line (English)" className="col-span-full">
              <Textarea
                rows={2}
                value={state.optOut.en}
                onChange={(e) => edit({ optOut: { ...state.optOut, en: e.target.value } })}
              />
            </Field>
            <Field label="Daily sending limit">
              <Input type="number" min={1} max={200} value={state.dailyCap} onChange={(e) => edit({ dailyCap: e.target.value })} />
            </Field>
            <Field label="New leads to show on Today">
              <Input
                type="number"
                min={1}
                max={50}
                value={state.scoring.perDay}
                onChange={(e) => editScoring({ perDay: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Fit score"
            subtitle="How the 0–100 score weighs each factor. Move a slider and every list re-ranks."
          />
          <div className="grid max-w-[640px] gap-3.5">
            {WEIGHT_INFO.map(([key, label, help]) => (
              <div key={key} className="grid grid-cols-[110px_minmax(0,1fr)_52px] items-center gap-x-2.5">
                <label htmlFor={`w-${key}`} className="text-sm font-medium">
                  {label}
                </label>
                <input
                  id={`w-${key}`}
                  type="range"
                  min={0}
                  max={100}
                  value={state.scoring.weights[key]}
                  onChange={(e) =>
                    editScoring({ weights: { ...state.scoring.weights, [key]: Number(e.target.value) } })
                  }
                  className="w-full accent-accent"
                />
                <span className="text-right text-[13px] tabular-nums text-muted">
                  {Math.round((100 * state.scoring.weights[key]) / weightTotal)}%
                </span>
                <p className="col-start-2 col-end-4 m-0 text-[12.5px] text-muted">{help}</p>
              </div>
            ))}
            <div>
              <Button size="sm" onClick={() => editScoring({ weights: { ...DEFAULT_WEIGHTS } })}>
                Reset to defaults
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Category tiers"
            subtitle="How promising each line of work is. Excluded categories score 0 and never appear on Today."
          />
          <div className="grid gap-x-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
            {categories.map((category) => (
              <label key={category} className="flex items-center justify-between gap-2 border-b border-line py-1">
                <span className="min-w-0 truncate text-sm">{category}</span>
                <Select
                  className="w-auto py-0.5 text-[12.5px]"
                  value={tierOf(category, state.scoring.tiers)}
                  onChange={(e) => editScoring({ tiers: { ...state.scoring.tiers, [category]: e.target.value } })}
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABEL[t]}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </Button>
          {form && <span className="text-[13px] text-muted">Unsaved changes</span>}
          {message && <Message tone={message.tone}>{message.text}</Message>}
        </div>
      </form>
    </>
  );
}
