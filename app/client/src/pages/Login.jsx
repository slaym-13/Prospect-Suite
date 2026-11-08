import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Message } from '../components/ui/Feedback';
import { AuthShell } from '../features/auth/AuthShell';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [canSignup, setCanSignup] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .session()
      .then((s) => {
        if (s.user) navigate('/', { replace: true });
        else setCanSignup(s.allowSignup !== false);
      })
      .catch(() => {});
  }, [navigate]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      await api.login(form.email, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Your companies, emails and outreach in one place."
      footer={canSignup ? <>No account yet? <Link to="/signup">Create one</Link></> : null}
    >
      <form className="grid gap-3" onSubmit={onSubmit} noValidate>
        <Field label="Email">
          <Input type="email" autoComplete="username" required autoFocus value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" required value={form.password} onChange={set('password')} />
        </Field>
        {error && <Message tone="bad">{error}</Message>}
        <Button type="submit" variant="primary" disabled={busy} className="mt-1 justify-center py-2.5">
          {busy ? 'Please wait…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
}
