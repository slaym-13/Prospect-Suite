import { cn } from '../../lib/cn';

export function Card({ className, as: Tag = 'section', ...props }) {
  return (
    <Tag
      className={cn('rounded-card border border-line bg-surface p-[18px] shadow-card', className)}
      {...props}
    />
  );
}

/** Title + one line of explanation, the header every card in the app uses. */
export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
