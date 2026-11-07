import { useState } from 'react';
import { api } from '../../lib/api';
import { useApp } from '../../store/AppContext';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Message } from '../../components/ui/Feedback';
import { Pill } from '../../components/ui/Pill';

/**
 * Each person brings their own Gemini key. It is checked against Google before it is
 * saved, encrypted on the server, and never sent back here — so once it is in, the
 * only things we can show are "connected" and a Remove button.
 */
export function AiKeyCard() {
  const { config, refresh, toast } = useApp();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.saveAiKey(value.trim());
      setValue('');
      toast('AI connected');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.removeAiKey();
      toast('AI key removed');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="AI"
        subtitle="Your own Google Gemini key. It writes the email drafts and answers your questions in Ask."
        action={<Pill tone={config.ai ? 'good' : 'warn'}>{config.ai ? `connected · ${config.model}` : 'not set'}</Pill>}
      />

      {error && <Message tone="bad" className="mb-3">{error}</Message>}

      {config.ai ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 flex-1 text-[13px] text-muted">
            Your key is stored encrypted and is never shown again. Replace it by removing it and adding a new one.
          </p>
          <Button variant="danger" onClick={remove} disabled={busy}>
            {busy ? 'Removing…' : 'Remove key'}
          </Button>
        </div>
      ) : (
        <form className="grid gap-3" onSubmit={save}>
          <p className="m-0 text-[13px] text-muted">
            Get a free key at{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
              aistudio.google.com/apikey
            </a>
            . Without one the app still works: drafts fall back to a plain template.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Gemini API key" className="min-w-55 flex-1">
              <Input
                type="password"
                autoComplete="off"
                spellCheck="false"
                placeholder="AIza…"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="primary" disabled={busy || !value.trim()}>
              {busy ? 'Checking…' : 'Connect'}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
