import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Message } from '../components/ui/Feedback';
import { AuthShell } from '../features/auth/AuthShell';

const MIN_PASSWORD = 10;

/** Create your own account. The server checks everything again; this is for the person. */
export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [open, setOpen] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .session()
      .then((s) => {
        if (s.user) navigate('/', { replace: true });
        else setOpen(s.allowSignup !== false);
      })
      .catch(() => {});
  }, [navigate]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const tooShort = form.password.length > 0 && form.password.length < MIN_PASSWORD;
  const mismatch = form.confirm.length > 0 && form.password !== form.confirm;
  const ready = form.email && form.password.length >= MIN_PASSWORD && form.password === form.confirm;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!ready) return;
    setBusy(true);
    try {
      await api.signup(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <AuthShell
        title="Registration is closed"
        subtitle="New accounts are created by an administrator on this instance."
        footer={<Link to="/login">Back to sign in</Link>}
      >
        <div />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your own sign-in for Prospect Hub."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="grid gap-3" onSubmit={onSubmit} noValidate>
        <Field label="Email">
          <Input type="email" autoComplete="username" required autoFocus value={form.email} onChange={set('email')} />
        </Field>

        <Field label="Password" invalid={tooShort} hint={tooShort ? `${MIN_PASSWORD} characters minimum` : undefined}>
          <Input
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={set('password')}
            aria-invalid={tooShort || undefined}
          />
        </Field>

        <Field label="Confirm password" invalid={mismatch} hint={mismatch ? 'The two passwords do not match.' : undefined}>
          <Input
            type="password"
            autoComplete="new-password"
            required
            value={form.confirm}
            onChange={set('confirm')}
            aria-invalid={mismatch || undefined}
            className={mismatch ? 'border-bad' : undefined}
          />
        </Field>

        {error && <Message tone="bad">{error}</Message>}

        <Button type="submit" variant="primary" disabled={busy || !ready} className="mt-1 justify-center py-2.5">
          {busy ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
