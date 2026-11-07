import { useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useApp } from '../store/AppContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Field';
import { Message, Spinner } from '../components/ui/Feedback';
import { Pill, ScorePill } from '../components/ui/Pill';
import { DataTable } from '../components/ui/DataTable';
import { LeadDrawer } from '../features/lead/LeadDrawer';
import { STATUS_LABEL, STATUS_TONE, nf } from '../lib/format';

const EMAIL_FILTERS = [
  ['', 'All'],
  ['has', 'Has email'],
  ['none', 'No email'],
  ['nosite', 'No website']
];

export default function Companies() {
  const { leads, config, loading, error, loadLeads, toast } = useApp();
  const [query, setQuery] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState({ key: 'score', dir: -1 });
  const [limit, setLimit] = useState(100);
  const [openId, setOpenId] = useState(null);
  const fileRef = useRef(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = leads.filter((l) => {
      if (q && !`${l.nom} ${l.adresse} ${l.categorie} ${l.email}`.toLowerCase().includes(q)) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      if (emailFilter === 'has' && !l.email) return false;
      if (emailFilter === 'none' && l.email) return false;
      if (emailFilter === 'nosite' && l.site_web) return false;
      return true;
    });

    const { key, dir } = sort;
    return filtered.sort((a, b) => {
      const x = a[key];
      const y = b[key];
      if (typeof x === 'number' || typeof y === 'number') return ((Number(x) || 0) - (Number(y) || 0)) * dir;
      return String(x || '').localeCompare(String(y || '')) * dir;
    });
  }, [leads, query, emailFilter, statusFilter, sort]);

  function toggleSort(key) {
    setSort((s) => ({ key, dir: s.key === key ? -s.dir : key === 'nom' ? 1 : -1 }));
  }

  async function importCsv(file) {
    try {
      const result = await api.importCsv(await file.text());
      toast(`Imported: ${result.added} new, ${result.updated} updated`);
      loadLeads();
    } catch (e) {
      toast(e.message, 'bad');
    }
  }

  if (loading) return <Spinner />;
  if (error) return <Message tone="bad">{error}</Message>;

  const columns = [
    {
      key: 'nom',
      header: 'Company',
      sortable: true,
      render: (l) => (
        <>
          <strong className="font-semibold">
            {l.star && <span className="text-warn">★ </span>}
            {l.nom}
          </strong>
          <div className="text-xs text-muted">{l.telephone}</div>
        </>
      )
    },
    { key: 'categorie', header: 'Category', sortable: true, render: (l) => l.categorie || '' },
    { key: 'score', header: 'Score', sortable: true, align: 'right', render: (l) => <ScorePill score={l.score} excluded={l.excluded} /> },
    {
      key: 'note',
      header: 'Rating',
      sortable: true,
      align: 'right',
      render: (l) => (l.note ? `${l.note} (${l.nombre_avis || 0})` : '—')
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (l) => (l.email ? <span className="break-all">{l.email}</span> : <span className="text-muted">—</span>)
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (l) => <Pill tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Pill>
    }
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          placeholder="Search name, address, category…"
          aria-label="Search companies"
          className="flex-1 basis-55"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(100);
          }}
        />
        <Select className="w-auto" aria-label="Email filter" value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)}>
          {EMAIL_FILTERS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select className="w-auto" aria-label="Status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Any status</option>
          {config.statuses.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <span className="flex-1" />
        <Button onClick={() => fileRef.current.click()}>Import CSV</Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => e.target.files[0] && importCsv(e.target.files[0])}
        />
        <Button variant="primary" href="/api/export.csv">
          Download CSV
        </Button>
      </div>

      <Card>
        <p className="mb-3 text-[13px] text-muted">
          {nf(rows.length)} companies{rows.length > limit ? ` (showing ${limit})` : ''}
        </p>
        <DataTable
          columns={columns}
          rows={rows.slice(0, limit)}
          rowKey={(l) => l.id}
          onRowClick={(l) => setOpenId(l.id)}
          sort={sort}
          onSort={toggleSort}
          empty="No company matches these filters."
        />
        {rows.length > limit && (
          <div className="pt-3 text-center">
            <Button onClick={() => setLimit((n) => n + 200)}>Show more</Button>
          </div>
        )}
      </Card>

      {openId && <LeadDrawer leadId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
