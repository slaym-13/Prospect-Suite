import { cn } from '../../lib/cn';

const TONES = {
  neutral: 'bg-surface-2 text-muted',
  info: 'bg-accent-soft text-accent',
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad'
};

export function Pill({ tone = 'neutral', className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium',
        TONES[tone],
        className
      )}
      {...props}
    />
  );
}

/** The 0-100 fit score, coloured by band. */
export function ScorePill({ score, excluded }) {
  if (excluded) return <Pill title="Excluded category">–</Pill>;
  const tone = score >= 65 ? 'good' : score >= 45 ? 'warn' : 'neutral';
  return (
    <Pill tone={tone} className="min-w-9 justify-center tabular-nums">
      {score}
    </Pill>
  );
}
