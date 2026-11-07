import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApp } from '../../store/AppContext';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { Message } from '../../components/ui/Feedback';
import { cn } from '../../lib/cn';

const SUGGESTIONS = [
  'How does the fit score work?',
  'How do I find an email address?',
  'What happens when I log a contact?',
  'How many companies still have no email?'
];

/** Chat with the built-in help assistant. The conversation is kept on the server. */
export function AssistantPanel({ onClose }) {
  const { config } = useApp();
  const [history, setHistory] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    api
      .assistantHistory()
      .then((r) => setHistory(r.history))
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [history, busy]);

  async function send(text) {
    const message = (text ?? question).trim();
    if (!message || busy) return;
    setError('');
    setQuestion('');
    // Show what was asked straight away; the real history comes back with the answer.
    setHistory((h) => [...h, { role: 'user', text: message, at: new Date().toISOString() }]);
    setBusy(true);
    try {
      const r = await api.askAssistant(message);
      setHistory(r.history);
    } catch (e) {
      setError(e.message);
      setHistory((h) => h.slice(0, -1));
      setQuestion(message);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    await api.clearAssistant();
    setHistory([]);
    setError('');
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Ask"
      badge={<span className="text-[13px] text-muted">Questions about how to use Prospect Hub</span>}
    >
      {!config.ai && (
        <Message>
          Add your Gemini API key in <Link to="/settings">Settings</Link> to use the assistant.
        </Message>
      )}

      {!history.length && config.ai && (
        <div className="grid gap-2">
          <p className="m-0 text-[13px] text-muted">Try one of these:</p>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm hover:border-accent hover:text-accent"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {history.map((m, i) => (
        <div
          key={`${m.at}-${i}`}
          className={cn(
            'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm',
            m.role === 'user' ? 'justify-self-end bg-accent text-accent-fg' : 'justify-self-start bg-surface-2'
          )}
        >
          {m.text}
        </div>
      ))}

      {busy && <div className="justify-self-start rounded-2xl bg-surface-2 px-3.5 py-2.5 text-sm text-muted">Thinking…</div>}
      {error && <Message tone="bad">{error}</Message>}
      <div ref={endRef} />

      <form
        className="sticky bottom-0 flex gap-2 bg-surface pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Input
          placeholder="Ask about the app…"
          aria-label="Your question"
          maxLength={1000}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={!config.ai}
        />
        <Button type="submit" variant="primary" disabled={busy || !config.ai || !question.trim()}>
          Send
        </Button>
        {!!history.length && (
          <Button variant="ghost" onClick={clear} title="Clear this conversation">
            Clear
          </Button>
        )}
      </form>
    </Drawer>
  );
}
