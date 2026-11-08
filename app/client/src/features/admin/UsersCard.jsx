import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useApp } from '../../store/AppContext';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { Message } from '../../components/ui/Feedback';
import { Pill } from '../../components/ui/Pill';
import { shortDate } from '../../lib/format';

const BLANK = { email: '', password: '', role: 'user' };

/** Accounts: who can sign in, who administers, and who has connected an AI key. */
export function UsersCard() {
  const { config, toast } = useApp();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [resetting, setResetting] = useState(null);
  const [signupOpen, setSignupOpen] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.adminUsers().then(setUsers).catch((e) => setError(e.message));
    api.adminStats().then((s) => setSignupOpen(s.allowSignup !== false)).catch(() => {});
  }, []);

  async function run(fn, done) {
    setError('');
    setBusy(true);
    try {
      setUsers(await fn());
      if (done) toast(done);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const add = (e) => {
    e.preventDefault();
    run(async () => {
      const list = await api.adminCreateUser(form);
      setForm(BLANK);
      return list;
    }, `${form.email} added`);
  };

  const savePassword = (email) =>
    run(async () => {
      const list = await api.adminUpdateUser(email, { password });
      setResetting(null);
      setPassword('');
      return list;
    }, 'Password changed');

  return (
    <Card>
      <CardHeader
        title="Accounts"
        subtitle="Who can sign in, and who can reach this page."
        action={
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <input
              type="checkbox"
              className="size-4 accent-accent"
              checked={signupOpen}
              disabled={busy}
              onChange={async (e) => {
                const next = e.target.checked;
                setError('');
                setBusy(true);
                try {
                  await api.adminSetSignup(next);
                  setSignupOpen(next);
                  toast(next ? 'Anyone can now create an account' : 'Registration closed');
                } catch (err) {
                  setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            />
            Open registration
          </label>
        }
      />
      {error && <Message tone="bad" className="mb-3">{error}</Message>}
      {!signupOpen && (
        <Message tone="plain" className="mb-3">
          Registration is closed: new accounts can only be added here.
        </Message>
      )}

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {['Email', 'Role', 'AI key', 'Created', ''].map((h) => (
                <th key={h} className="border-b border-line bg-surface px-3 py-2 text-left text-xs font-semibold text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <span className="break-all">{u.email}</span>
                  {u.email === config.user && <span className="ml-1.5 text-xs text-muted">(you)</span>}
                  {u.defaultPassword && (
                    <Pill tone="bad" className="ml-1.5" title="Change this before the app is reachable publicly">
                      default password
                    </Pill>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Select
                    aria-label={`Role for ${u.email}`}
                    className="w-auto! py-0.5 text-xs"
                    value={u.role}
                    disabled={busy || u.email === config.user}
                    onChange={(e) => run(() => api.adminUpdateUser(u.email, { role: e.target.value }), 'Role changed')}
                  >
                    <option value="user">User</option>
                    <option value="admin">Administrator</option>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Pill tone={u.hasAiKey ? 'good' : 'neutral'}>{u.hasAiKey ? 'connected' : 'none'}</Pill>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted">{shortDate(u.createdAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setResetting(resetting === u.email ? null : u.email);
                        setPassword('');
                      }}
                    >
                      Password
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy || u.email === config.user}
                      onClick={() => {
                        if (window.confirm(`Delete the account ${u.email}?`)) {
                          run(() => api.adminDeleteUser(u.email), 'Account deleted');
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                  {resetting === u.email && (
                    <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                      <Input
                        type="password"
                        placeholder="New password (10+ characters)"
                        aria-label={`New password for ${u.email}`}
                        className="w-56"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <Button size="sm" variant="primary" disabled={busy} onClick={() => savePassword(u.email)}>
                        Save
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={add}>
        <Field label="Email" className="min-w-52 flex-1">
          <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" className="min-w-52 flex-1">
          <Input
            type="password"
            required
            placeholder="10 characters minimum"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="user">User</option>
            <option value="admin">Administrator</option>
          </Select>
        </Field>
        <Button type="submit" variant="primary" disabled={busy}>
          Add account
        </Button>
      </form>
    </Card>
  );
}
