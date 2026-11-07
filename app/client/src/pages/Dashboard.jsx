import { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Field';
import { Message, Spinner } from '../components/ui/Feedback';
import { ChartCard } from '../components/charts/ChartCard';
import { BarChart } from '../components/charts/BarChart';
import { KpiRow, Kpi } from '../components/ui/Kpi';
import { nf, pct, STATUS_LABEL } from '../lib/format';

const RATING_BANDS = [
  ['No rating', (n) => !n],
  ['< 3.5', (n) => n && n < 3.5],
  ['3.5–3.9', (n) => n >= 3.5 && n < 4],
  ['4.0–4.4', (n) => n >= 4 && n < 4.5],
  ['4.5–4.9', (n) => n >= 4.5 && n < 5],
  ['5.0', (n) => n >= 5]
];

export default function Dashboard() {
  const { leads, config, loading, error, startJob } = useApp();
  const [filters, setFilters] = useState({ category: '', status: '' });

  const categories = useMemo(() => {
    const counts = {};
    for (const l of leads) counts[l.categorie || '(none)'] = (counts[l.categorie || '(none)'] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const rows = useMemo(
    () =>
      leads.filter(
        (l) =>
          (!filters.category || (l.categorie || '(none)') === filters.category) &&
          (!filters.status || l.status === filters.status)
      ),
    [leads, filters]
  );

  if (loading) return <Spinner />;
  if (error) return <Message tone="bad">{error}</Message>;

  const total = rows.length;
  const withSite = rows.filter((l) => l.site_web).length;
  const withEmail = rows.filter((l) => l.email).length;
  const contacted = rows.filter((l) => l.status !== 'new').length;
  const replied = rows.filter((l) => ['replied', 'meeting', 'won'].includes(l.status)).length;
  const rated = rows.filter((l) => l.note);
  const avgRating = rated.length ? rated.reduce((s, l) => s + Number(l.note), 0) / rated.length : 0;

  const funnel = [
    ['Companies', total],
    ['With website', withSite],
    ['Email found', withEmail],
    ['Contacted', contacted],
    ['Replied', replied]
  ];

  const topCategories = categories.filter(([c]) => !filters.category || c === filters.category).slice(0, 8);
  const catLabels = topCategories.map(([c]) => c);
  const catWith = catLabels.map((c) => rows.filter((l) => (l.categorie || '(none)') === c && l.email).length);
  const catWithout = catLabels.map((c, i) => topCategories[i][1] - catWith[i]);

  const ratingCounts = RATING_BANDS.map(([, test]) => rows.filter((l) => test(Number(l.note) || 0)).length);
  const statuses = config.statuses;
  const statusCounts = statuses.map((s) => rows.filter((l) => l.status === s).length);

  const noEmail = rows.filter((l) => !l.email).length;
  const noSite = rows.filter((l) => !l.site_web).length;
  const readyToContact = rows.filter((l) => l.email && l.status === 'new').length;
  const dueToday = rows.filter((l) => l.nextStep && l.nextStep <= new Date().toISOString().slice(0, 10)).length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[13px] text-muted">
          Category
          <Select
            className="w-auto"
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="">All categories</option>
            {categories.map(([c, n]) => (
              <option key={c} value={c}>
                {c} ({n})
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-1.5 text-[13px] text-muted">
          Status
          <Select
            className="w-auto"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </label>
        <span className="flex-1" />
        {config.places && <Button onClick={() => startJob('places')}>Fill websites (Places)</Button>}
        <Button variant="primary" href="/api/export.csv">
          Download CSV with emails
        </Button>
      </div>

      <KpiRow>
        <Kpi hero label="Companies with an email" value={nf(withEmail)} detail={`${pct(withEmail, total)} of ${nf(total)} companies`} />
        <Kpi label="Companies" value={nf(total)} detail={avgRating ? `Average rating ${avgRating.toFixed(2)}` : ''} />
        <Kpi label="With a website" value={nf(withSite)} detail={pct(withSite, total)} />
        <Kpi label="Contacted" value={nf(contacted)} detail={pct(contacted, total)} />
        <Kpi label="Replied" value={nf(replied)} detail={contacted ? `${pct(replied, contacted)} of contacted` : ''} />
      </KpiRow>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
        <ChartCard
          title="Outreach funnel"
          subtitle="How many companies reach each step"
          table={{ head: ['Step', 'Companies', 'Share'], rows: funnel.map(([l, v]) => [l, nf(v), pct(v, total)]) }}
        >
          <BarChart
            ariaLabel="Outreach funnel"
            horizontal
            labels={funnel.map(([l]) => l)}
            datasets={[{ data: funnel.map(([, v]) => v), color: '--color-accent' }]}
            tooltipLabel={(c) => ` ${nf(c.parsed.x)} (${pct(c.parsed.x, total)} of all)`}
          />
        </ChartCard>

        <ChartCard
          title="Email coverage by category"
          subtitle="Top categories, companies with and without an email"
          table={{ head: ['Category', 'With email', 'No email yet'], rows: catLabels.map((c, i) => [c, catWith[i], catWithout[i]]) }}
        >
          <BarChart
            ariaLabel="Email coverage by category"
            horizontal
            stacked
            legend
            height={340}
            labels={catLabels}
            datasets={[
              { label: 'With email', data: catWith, color: '--color-accent' },
              { label: 'No email yet', data: catWithout, color: '--color-neutral' }
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Google rating"
          subtitle="Number of companies per rating band"
          table={{ head: ['Band', 'Companies'], rows: RATING_BANDS.map(([l], i) => [l, ratingCounts[i]]) }}
        >
          <BarChart
            ariaLabel="Companies per Google rating band"
            labels={RATING_BANDS.map(([l]) => l)}
            datasets={[
              { data: ratingCounts, colors: RATING_BANDS.map((_, i) => (i === 0 ? '--color-neutral' : '--color-accent')) }
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Pipeline"
          subtitle="Companies by outreach status"
          table={{ head: ['Status', 'Companies'], rows: statuses.map((s, i) => [STATUS_LABEL[s], statusCounts[i]]) }}
        >
          <BarChart
            ariaLabel="Companies by outreach status"
            horizontal
            labels={statuses.map((s) => STATUS_LABEL[s])}
            datasets={[
              {
                data: statusCounts,
                colors: statuses.map((s) => (['optout', 'lost'].includes(s) ? '--color-neutral' : '--color-accent'))
              }
            ]}
          />
        </ChartCard>

        <Card>
          <h2 className="text-base font-semibold tracking-tight">Next actions</h2>
          <p className="mt-0.5 text-[13px] text-muted">What would grow your contact list</p>
          <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-sm">
            <li>{nf(readyToContact)} companies have an email and have not been contacted yet.</li>
            <li>{nf(dueToday)} follow-ups are due today — they are waiting on the Today page.</li>
            <li>{nf(noEmail)} companies have no email address; {nf(noSite)} have no website either.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
