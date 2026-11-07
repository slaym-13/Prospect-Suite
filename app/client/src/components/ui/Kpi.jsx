import { cn } from '../../lib/cn';

export function KpiRow({ children }) {
  return <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">{children}</div>;
}

/** One headline number. `hero` makes it the wide, tinted one. */
export function Kpi({ label, value, detail, hero }) {
  return (
    <div
      className={cn(
        'rounded-card border p-4 shadow-card',
        hero ? 'border-transparent bg-accent-soft sm:col-span-2' : 'border-line bg-surface'
      )}
    >
      <div className="text-[13px] text-muted">{label}</div>
      <div className={cn('font-semibold leading-tight tabular-nums', hero ? 'text-5xl' : 'text-[28px]')}>{value}</div>
      {detail && <div className="text-xs text-muted opacity-85">{detail}</div>}
    </div>
  );
}
