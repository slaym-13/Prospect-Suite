import { cn } from '../../lib/cn';

const TONES = {
  info: 'bg-warn-soft text-warn',
  good: 'bg-good-soft text-good',
  bad: 'bg-bad-soft text-bad',
  plain: 'bg-surface-2 text-muted'
};

/** Inline message: the result of an action, shown where the action happened. */
export function Message({ tone = 'info', className, children }) {
  if (!children) return null;
  return (
    <div role="status" className={cn('rounded-xl px-3 py-2 text-[13px]', TONES[tone], className)}>
      {children}
    </div>
  );
}

export function Empty({ children }) {
  return (
    <div className="rounded-card border border-dashed border-line p-5 text-center text-muted">{children}</div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return <div className="p-8 text-center text-muted">{label}</div>;
}

/** Stacked notifications, rendered once by the layout. */
export function Toasts({ items }) {
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-60 grid -translate-x-1/2 gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'pointer-events-auto max-w-[90vw] rounded-full px-4 py-2.5 text-sm shadow-lg',
            t.tone === 'bad' ? 'bg-bad text-white' : 'bg-fg text-bg'
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
