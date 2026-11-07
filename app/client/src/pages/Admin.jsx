import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useApp } from '../store/AppContext';
import { Message, Spinner } from '../components/ui/Feedback';
import { KpiRow, Kpi } from '../components/ui/Kpi';
import { UsersCard } from '../features/admin/UsersCard';
import { DataCard } from '../features/admin/DataCard';
import { nf } from '../lib/format';

/** Administration. The server refuses these routes to anyone else; this only hides them. */
export default function Admin() {
  const { config, loading } = useApp();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!config?.isAdmin) return;
    api.adminStats().then(setStats).catch((e) => setError(e.message));
  }, [config]);

  if (loading) return <Spinner />;
  if (!config.isAdmin) return <Navigate to="/" replace />;

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        <p className="mt-1 max-w-[62ch] text-muted">
          Accounts and the company records. Changes here affect everyone signed in.
        </p>
      </div>

      {error && <Message tone="bad">{error}</Message>}

      {stats && (
        <KpiRow>
          <Kpi label="Companies" value={nf(stats.companies)} detail={`${nf(stats.withEmail)} with an email`} />
          <Kpi label="Contacted" value={nf(stats.contacted)} detail={`${nf(stats.sent)} emails sent`} />
          <Kpi label="Contacts logged" value={nf(stats.logged)} detail="calls, visits, messages" />
          <Kpi label="Accounts" value={nf(stats.users)} detail={`${nf(stats.admins)} administrator(s)`} />
        </KpiRow>
      )}

      <UsersCard />
      <DataCard />
    </>
  );
}
