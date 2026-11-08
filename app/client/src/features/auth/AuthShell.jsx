/** The centred card both the sign-in and sign-up pages sit in. */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-5">
      <div className="grid w-[min(400px,100%)] gap-4 rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
          <span className="relative inline-block size-7 rounded-full bg-accent" aria-hidden="true">
            <span className="absolute left-2 top-[7px] h-3.5 w-[5px] bg-accent-fg" />
            <span className="absolute left-[15px] top-[11px] h-2.5 w-[5px] bg-accent-fg" />
          </span>
          Prospect Hub
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>

        {children}

        {footer && <p className="m-0 border-t border-line pt-3 text-center text-[13px] text-muted">{footer}</p>}
      </div>
    </main>
  );
}
