import { DrawerSection } from '../../components/ui/Drawer';
import { ScorePill } from '../../components/ui/Pill';

/** Why this company scored what it scored: one bar and one sentence per factor. */
export function ScoreBreakdown({ scored }) {
  return (
    <DrawerSection title="Fit score" action={<ScorePill score={scored.score} excluded={scored.excluded} />}>
      <div className="grid gap-2.5">
        {scored.parts.map((part) => (
          <div key={part.key} className="grid grid-cols-[78px_minmax(0,1fr)_44px] items-center gap-x-2.5 gap-y-1">
            <b className="text-[13px] font-semibold">{part.label}</b>
            <div className="h-[7px] overflow-hidden rounded bg-surface-2">
              <div className="h-full rounded bg-accent" style={{ width: `${Math.round(part.fraction * 100)}%` }} />
            </div>
            <span className="text-right text-[12.5px] font-medium tabular-nums">+{Math.round(part.points)}</span>
            <span className="col-start-2 col-end-4 text-[12.5px] text-muted">{part.note}</span>
          </div>
        ))}
      </div>
    </DrawerSection>
  );
}
