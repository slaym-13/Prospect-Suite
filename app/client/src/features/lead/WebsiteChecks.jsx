import { DrawerSection } from '../../components/ui/Drawer';
import { CHECKS } from '../../lib/scoring';
import { cn } from '../../lib/cn';

/**
 * Five yes/no questions about the company's website. They feed the Pain factor,
 * so answering them makes the score more accurate.
 */
export function WebsiteChecks({ lead, onPatch }) {
  const checks = lead.checks || {};

  function set(key, value) {
    const next = { ...checks };
    if (value === null) delete next[key];
    else next[key] = value;
    onPatch({ checks: next });
  }

  return (
    <DrawerSection title="Website checks">
      <p className="text-[12.5px] text-muted">
        Open the site and answer these. They change the Pain part of the score.
      </p>
      <div className="grid gap-1.5">
        {CHECKS.map(([key, label]) => {
          const value = typeof checks[key] === 'boolean' ? checks[key] : null;
          return (
            <div key={key} className="flex items-center justify-between gap-2 text-sm">
              <span>{label}</span>
              <div className="inline-flex overflow-hidden rounded-full border border-line" role="group" aria-label={label}>
                {[
                  [null, '?'],
                  [true, 'Yes'],
                  [false, 'No']
                ].map(([option, text]) => (
                  <button
                    key={text}
                    type="button"
                    aria-pressed={value === option}
                    onClick={() => set(key, option)}
                    className={cn(
                      'border-r border-line px-2.5 py-1 text-[12.5px] last:border-r-0',
                      value === option
                        ? option === false
                          ? 'bg-bad text-white'
                          : 'bg-accent text-accent-fg'
                        : 'bg-surface text-muted'
                    )}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </DrawerSection>
  );
}
