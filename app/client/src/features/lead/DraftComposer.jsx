import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useApp } from '../../store/AppContext';
import { DrawerSection } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { Message } from '../../components/ui/Feedback';
import { dateTime } from '../../lib/format';

const newRequestId = () => 'r' + Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Write the email (Claude or a template), edit it, send it. */
export function DraftComposer({ lead, onUpdate }) {
  const { settings, config } = useApp();
  const draft = lead.draft || {};

  const [options, setOptions] = useState({
    goal: draft.goal || settings?.goal || 'internship',
    language: draft.language || settings?.language || 'fr',
    tone: 'formal',
    extra: ''
  });
  const [subject, setSubject] = useState(draft.subject || '');
  const [body, setBody] = useState(draft.body || '');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const requestId = useRef(newRequestId());

  useEffect(() => {
    const d = lead.draft || {};
    setSubject(d.subject || '');
    setBody(d.body || '');
    requestId.current = newRequestId();
  }, [lead.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => setOptions((o) => ({ ...o, [key]: e.target.value }));

  async function generate() {
    setBusy('draft');
    setMessage(null);
    try {
      const d = await api.draft(lead.id, options);
      setSubject(d.subject || '');
      setBody(d.body || '');
      requestId.current = newRequestId();
      setMessage(
        d.ai === false
          ? {
              tone: 'info',
              text: d.aiError
                ? `AI unavailable (${d.aiError}). A basic template was used.`
                : 'No ANTHROPIC_API_KEY set: a basic template was used. Edit it before sending.'
            }
          : { tone: 'good', text: 'Draft written by Claude. Check every detail before sending.' }
      );
    } catch (e) {
      setMessage({ tone: 'bad', text: e.message });
    } finally {
      setBusy('');
    }
  }

  async function send(force = false) {
    if (!lead.email) return setMessage({ tone: 'bad', text: 'Add or find an email address first.' });
    const warning = config.smtp === 'dry-run' ? '\n(Dry-run mode: nothing is delivered.)' : '';
    if (!force && !window.confirm(`Send this email to ${lead.email}?${warning}`)) return;

    setBusy('send');
    setMessage(null);
    try {
      const r = await api.send(lead.id, {
        subject,
        body,
        language: options.language,
        requestId: requestId.current,
        force
      });
      onUpdate(r.lead);
      setMessage({
        tone: 'good',
        text: `Sent to ${r.entry.to}${r.entry.mode === 'dry-run' ? ' (dry-run, not delivered)' : ''}.`
      });
    } catch (e) {
      if (e.status === 409 && e.body.code === 'RECENT' && window.confirm(`${e.message}\nSend again anyway?`)) {
        setBusy('');
        return send(true);
      }
      setMessage({ tone: 'bad', text: e.message });
    } finally {
      setBusy('');
    }
  }

  const history = (lead.sent || []).slice().reverse();

  return (
    <DrawerSection title="Write &amp; send">
      {message && <Message tone={message.tone}>{message.text}</Message>}

      <div className="flex flex-wrap gap-1.5">
        <Select className="w-auto" aria-label="Goal" value={options.goal} onChange={set('goal')}>
          <option value="internship">Internship request</option>
          <option value="pitch">Service pitch</option>
        </Select>
        <Select className="w-auto" aria-label="Language" value={options.language} onChange={set('language')}>
          <option value="fr">Français</option>
          <option value="en">English</option>
        </Select>
        <Select className="w-auto" aria-label="Tone" value={options.tone} onChange={set('tone')}>
          <option value="formal">Formal</option>
          <option value="friendly">Warm</option>
          <option value="short">Very short</option>
        </Select>
      </div>

      <Input
        placeholder="Optional hint for the AI (e.g. mention their new office)"
        aria-label="Hint for the AI"
        maxLength={300}
        value={options.extra}
        onChange={set('extra')}
      />

      <div>
        <Button onClick={generate} disabled={busy === 'draft'}>
          {busy === 'draft' ? 'Writing…' : 'Write draft with AI'}
        </Button>
      </div>

      <Input
        placeholder="Subject"
        aria-label="Subject"
        maxLength={150}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <Textarea
        rows={10}
        aria-label="Message"
        placeholder="Generate a draft, then edit it freely."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="primary" onClick={() => send(false)} disabled={busy === 'send'}>
          {busy === 'send' ? 'Sending…' : 'Send email'}
        </Button>
        <span className="text-[13px] text-muted">{lead.email ? `To: ${lead.email}` : 'No recipient yet'}</span>
      </div>

      {!!history.length && (
        <div className="grid gap-2 text-[13px]">
          <h4 className="font-semibold">Sent before</h4>
          {history.map((s) => (
            <div key={s.id || s.at} className="border-l-2 border-line pl-2.5">
              {dateTime(s.at)} · {s.ok ? 'sent' : 'failed'} · {s.subject}
              {s.error ? ` · ${s.error}` : ''}
            </div>
          ))}
        </div>
      )}
    </DrawerSection>
  );
}
