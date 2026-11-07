import { cn } from '../../lib/cn';

const CONTROL =
  'w-full min-w-0 rounded-xl border border-line bg-surface px-2.5 py-2 text-sm placeholder:text-muted/70';

/** Label above a control. Children are the control itself. */
export function Field({ label, hint, className, children }) {
  return (
    <label className={cn('grid content-end gap-1 text-xs text-muted', className)}>
      <span>{label}</span>
      {children}
      {hint && <span className="text-[11px] opacity-80">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }) {
  return <input className={cn(CONTROL, 'text-fg', className)} {...props} />;
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(CONTROL, 'resize-y leading-relaxed text-fg', className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(CONTROL, 'text-fg', className)} {...props}>
      {children}
    </select>
  );
}
