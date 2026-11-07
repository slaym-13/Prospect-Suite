import { useMemo, useState } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { useApp } from '../../store/AppContext';
import { TIERS, tierOf } from '../../lib/scoring';
import { nf } from '../../lib/format';
import { cn } from '../../lib/cn';

/** Short labels: the five-option dropdown per row was unreadable at 20+ rows. */
const TIER_META = {
  A: ['A', 'Best fit', 'bg-good text-white', 'text-good'],
  B: ['B', 'Good', 'bg-accent text-accent-fg', 'text-accent'],
  C: ['C', 'Maybe', 'bg-warn text-white', 'text-warn'],
  D: ['D', 'Weak', 'bg-neutral text-fg', 'text-muted'],
  X: ['✕', 'Excluded', 'bg-bad text-white', 'text-bad']
};

/** Five buttons beat a dropdown here: the current value is visible without opening anything. */
function TierPicker({ value, onChange, label }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-line" role="group" aria-label={label}>
      {TIERS.map((tier) => {
        const [short, title, activeClass] = TIER_META[tier];
        const active = value === tier;
        return (
          <button
            key={tier}
            type="button"
            title={title}
            aria-pressed={active}
            onClick={() => onChange(tier)}
            className={cn(
              'w-7 border-r border-line py-1 text-xs font-semibold last:border-r-0',
              active ? activeClass : 'bg-surface text-muted hover:bg-surface-2'
            )}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Category tiers. Sorted by how many companies each category holds, so the ones
 * that actually move the rankings are at the top rather than buried alphabetically.
 */
export function TierCard({ scoring, onChange }) {
  const { leads } = useApp();
  const [query, setQuery] = useState('');

  const categories = useMemo(() => {
    const counts = new Map();
    for (const lead of leads) {
      if (!lead.categorie) continue;
      counts.set(lead.categorie, (counts.get(lead.categorie) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [leads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories;
  }, [categories, query]);

  const setTier = (name, tier) => onChange({ tiers: { ...scoring.tiers, [name]: tier } });
  const excluded = categories.filter((c) => tierOf(c.name, scoring.tiers) === 'X');
  const excludedCompanies = excluded.reduce((n, c) => n + c.count, 0);

  return (
    <Card>
      <CardHeader
        title="Category tiers"
        subtitle="How promising each line of work is. Excluded categories score 0 and never reach Today."
        action={
          <Input
            type="search"
            placeholder="Find a category…"
            aria-label="Find a category"
            className="w-44"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
        {TIERS.map((tier) => {
          const [short, title, , textClass] = TIER_META[tier];
          return (
            <span key={tier} className="flex items-center gap-1.5">
              <b className={cn('tabular-nums', textClass)}>{short}</b> {title}
            </span>
          );
        })}
      </div>

      <div className="max-h-96 overflow-y-auto rounded-xl border border-line">
        {visible.map(({ name, count }, i) => (
          <div
            key={name}
            className={cn(
              'flex items-center gap-3 px-3 py-1.5',
              i % 2 === 1 && 'bg-surface-2/60'
            )}
          >
            <span className="min-w-0 flex-1 truncate text-sm" title={name}>
              {name}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted">{nf(count)}</span>
            <TierPicker
              label={`Tier for ${name}`}
              value={tierOf(name, scoring.tiers)}
              onChange={(tier) => setTier(name, tier)}
            />
          </div>
        ))}
        {!visible.length && <p className="px-3 py-4 text-center text-[13px] text-muted">No category matches.</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted">
        <span>
          {nf(categories.length)} categories
          {excluded.length > 0 && ` · ${nf(excluded.length)} excluded, hiding ${nf(excludedCompanies)} companies`}
        </span>
        {Object.keys(scoring.tiers).length > 0 && (
          <Button size="sm" onClick={() => onChange({ tiers: {} })}>
            Back to suggested tiers
          </Button>
        )}
      </div>
    </Card>
  );
}
