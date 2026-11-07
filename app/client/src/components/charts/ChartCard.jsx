import { useState } from 'react';
import { Card } from '../ui/Card';
import { cn } from '../../lib/cn';

/**
 * A chart with a Table view behind a toggle: every figure on the dashboard
 * stays readable for people who cannot use the chart.
 *
 * @param table {{head: string[], rows: Array<Array<string|number>>}}
 */
export function ChartCard({ title, subtitle, table, children }) {
  const [view, setView] = useState('chart');

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-full border border-line" role="group" aria-label={`${title} view`}>
          {['chart', 'table'].map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
              className={cn(
                'px-2.5 py-0.5 text-xs capitalize',
                view === mode ? 'bg-accent-soft font-semibold text-accent' : 'text-muted'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {view === 'chart' ? (
        children
      ) : (
        <div className="max-h-[340px] overflow-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {table.head.map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={cn(
                      'sticky top-0 border-b border-line bg-surface px-2 py-1.5 text-left font-semibold text-muted',
                      i > 0 && 'text-right'
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={String(row[0])} className="border-b border-line last:border-0">
                  {row.map((cell, i) => (
                    <td key={i} className={cn('px-2 py-1.5', i > 0 && 'text-right tabular-nums')}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
