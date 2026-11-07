import { useMemo } from 'react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useApp } from '../../store/AppContext';
import { DEFAULT_WEIGHTS, WEIGHT_INFO, scoreLead } from '../../lib/scoring';
import { nf } from '../../lib/format';

const BANDS = [
  ['Priority', 65, 'text-good', 'bg-good'],
  ['Worth a look', 45, 'text-warn', 'bg-warn'],
  ['Low', 0, 'text-muted', 'bg-neutral']
];

/**
 * The four weights, with the thing that was missing: a live count of where the
 * companies land. Moving a slider shows its effect immediately, so the numbers
 * are chosen against real data instead of guessed.
 */
export function ScoringCard({ scoring, onChange }) {
  const { rawLeads } = useApp();

  const preview = useMemo(() => {
    const counts = [0, 0, 0];
    for (const lead of rawLeads) {
      const { score, excluded } = scoreLead(lead, scoring);
      if (excluded) continue;
      counts[score >= 65 ? 0 : score >= 45 ? 1 : 2] += 1;
    }
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    return { counts, total, excluded: rawLeads.length - total };
  }, [rawLeads, scoring]);

  const weights = scoring.weights;
  const sum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const isDefault = WEIGHT_INFO.every(([key]) => weights[key] === DEFAULT_WEIGHTS[key]);

  return (
    <Card>
      <CardHeader
        title="Fit score"
        subtitle="How much each factor counts. Move a slider and every ranking updates straight away."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="grid content-start gap-4">
          {WEIGHT_INFO.map(([key, label, help]) => {
            const share = Math.round((100 * weights[key]) / sum);
            return (
              <div key={key} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-x-3 gap-y-1">
                <label htmlFor={`w-${key}`} className="text-sm font-medium">
                  {label}
                </label>
                <output
                  htmlFor={`w-${key}`}
                  className="justify-self-end rounded-full bg-accent-soft px-2 py-0.5 text-[13px] font-semibold tabular-nums text-accent"
                >
                  {share}%
                </output>
                <input
                  id={`w-${key}`}
                  type="range"
                  min={0}
                  max={60}
                  step={5}
                  value={weights[key]}
                  onChange={(e) => onChange({ weights: { ...weights, [key]: Number(e.target.value) } })}
                  className="col-span-2 w-full accent-accent"
                />
                <p className="col-span-2 m-0 text-[12.5px] text-muted">{help}</p>
              </div>
            );
          })}

          <div>
            <Button size="sm" disabled={isDefault} onClick={() => onChange({ weights: { ...DEFAULT_WEIGHTS } })}>
              {isDefault ? 'Default weights' : 'Reset to defaults'}
            </Button>
          </div>
        </div>

        <div className="grid content-start gap-2 rounded-card bg-surface-2 p-3.5">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            With these weights
          </h3>
          {BANDS.map(([label, min, textClass, barClass], i) => {
            const count = preview.counts[i];
            const pct = Math.round((100 * count) / preview.total);
            return (
              <div key={label} className="grid gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className={textClass}>
                    {label} <span className="text-muted">({min === 0 ? '< 45' : `${min}+`})</span>
                  </span>
                  <b className="tabular-nums">{nf(count)}</b>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                  <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          <p className="m-0 mt-1 text-[12px] text-muted">
            Out of {nf(preview.total)} scored companies.
            {preview.excluded > 0 && ` ${nf(preview.excluded)} excluded by their tier.`}
          </p>
        </div>
      </div>
    </Card>
  );
}
