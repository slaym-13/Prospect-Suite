import { useEffect, useRef } from 'react';
import { Button } from './Button';

/** Right-hand panel. Closes on Escape or a click outside, and restores focus. */
export function Drawer({ open, onClose, title, badge, children }) {
  const panelRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previousFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[rgb(8_10_30/0.45)]" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-y-0 right-0 z-50 w-[min(560px,100%)] overflow-y-auto border-l border-line bg-surface shadow-[-12px_0_40px_rgb(8_10_30/0.18)] outline-none"
      >
        <div className="flex items-start gap-2.5 px-4 pt-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight break-words">{title}</h2>
            {badge && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{badge}</div>}
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close" className="px-2.5">
            ✕
          </Button>
        </div>
        <div className="grid content-start gap-4 p-4">{children}</div>
      </aside>
    </>
  );
}

/** A bordered block inside the drawer. */
export function DrawerSection({ title, children, action }) {
  return (
    <section className="grid gap-2.5 rounded-card border border-line bg-surface p-3.5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
