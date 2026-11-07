import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Card, CardHeader } from '../components/ui/Card';
import { Message, Spinner } from '../components/ui/Feedback';
import { Pill } from '../components/ui/Pill';
import { DataTable } from '../components/ui/DataTable';
import { LeadDrawer } from '../features/lead/LeadDrawer';
import { dateTime } from '../lib/format';

/** Every message the app tried to send. */
export default function Outbox() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    api.outbox().then(setRows).catch((e) => setError(e.message));
  }, []);

  if (error) return <Message tone="bad">{error}</Message>;
  if (!rows) return <Spinner />;

  const columns = [
    { key: 'at', header: 'When', render: (s) => dateTime(s.at) },
    { key: 'company', header: 'Company', render: (s) => s.company },
    { key: 'to', header: 'To', render: (s) => s.to },
    { key: 'subject', header: 'Subject', render: (s) => s.subject },
    {
      key: 'result',
      header: 'Result',
      render: (s) => (
        <span className="flex flex-wrap items-center gap-1">
          <Pill tone={s.ok ? 'good' : 'bad'}>{s.ok ? (s.mode === 'dry-run' ? 'dry-run' : 'sent') : 'failed'}</Pill>
          {s.error && <span className="text-xs text-muted">{s.error}</span>}
        </span>
      )
    }
  ];

  return (
    <>
      <Card>
        <CardHeader title="Outbox" subtitle="Every message this app tried to send (latest 500)" />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(s) => s.id || `${s.leadId}-${s.at}`}
          onRowClick={(s) => setOpenId(s.leadId)}
          empty="Nothing sent yet."
        />
      </Card>

      {openId && <LeadDrawer leadId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
