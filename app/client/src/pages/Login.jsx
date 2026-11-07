import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Message } from '../components/ui/Feedback';

/** Sign in, or create the first account when the database has no user yet. */
export default function Login() {
  const navigate = useNavigate();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .session()
      .then((s) => {
        if (s.user) navigate('/', { replace: true });
        else setNeedsSetup(!!s.needsSetup);
      })
      .catch(() => {});
  }, [navigate]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) return setError('Enter your email and password.');
    if (needsSetup && form.password !== form.confirm) return setError('The two passwords do not match.');

    setBusy(true);
    try {
      if (needsSetup) await api.setup(form.email, form.password);
      else await api.login(form.email, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-5">
      <div className="grid w-[min(400px,100%)] gap-4 rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
          <span className="relative inline-block size-7 rounded-full bg-accent" aria-hidden="true">
            <span className="absolute left-2 top-[7px] h-3.5 w-[5px] bg-accent-fg" />
            <span className="absolute left-[15px] top-[11px] h-2.5 w-[5px] bg-accent-fg" />
          </span>
          Prospect Hub
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{needsSetup ? 'Create your account' : 'Sign in'}</h1>
          <p className="mt-1 text-sm text-muted">
            {needsSetup
              ? 'First start: choose the email and password you will use to sign in (10 characters minimum).'
              : 'Your companies, emails and outreach in one place.'}
          </p>
        </div>

        <form className="grid gap-3" onSubmit={onSubmit} noValidate>
          <Field label="Email">
            <Input type="email" autoComplete="username" required autoFocus value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete={needsSetup ? 'new-password' : 'current-password'}
              required
              value={form.password}
              onChange={set('password')}
            />
          </Field>
          {needsSetup && (
            <Field label="Confirm password">
              <Input type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
            </Field>
          )}
          {error && <Message tone="bad">{error}</Message>}
          <Button type="submit" variant="primary" disabled={busy} className="mt-1 justify-center py-2.5">
            {busy ? 'Please wait…' : needsSetup ? 'Create account' : 'Sign in'}
          </Button>
        </form>
      </div>
    </main>
  );
}
