import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApp } from '../../store/AppContext';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../ui/Button';
import { Toasts } from '../ui/Feedback';
import { JobBar } from './JobBar';
import { AssistantPanel } from '../../features/assistant/AssistantPanel';
import { cn } from '../../lib/cn';

const TABS = [
  ['/', 'Dashboard'],
  ['/today', 'Today'],
  ['/companies', 'Companies'],
  ['/pipeline', 'Pipeline'],
  ['/outbox', 'Outbox'],
  ['/settings', 'Settings'],
  ['/admin', 'Admin', 'admin']   // only shown to administrators
];

function Logo() {
  return (
    <span className="relative inline-block size-7 shrink-0 rounded-full bg-accent" aria-hidden="true">
      <span className="absolute left-2 top-[7px] h-3.5 w-[5px] bg-accent-fg" />
      <span className="absolute left-[15px] top-[11px] h-2.5 w-[5px] bg-accent-fg" />
    </span>
  );
}

export function AppLayout() {
  const { config, toasts, leads } = useApp();
  const { theme, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const [askOpen, setAskOpen] = useState(false);

  const dueCount = leads.filter((l) => l.nextStep && l.nextStep <= new Date().toISOString().slice(0, 10)
    && !['won', 'lost', 'optout'].includes(l.status)).length;

  async function signOut() {
    await api.logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <div className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
            <Logo />
            Prospect Hub
          </div>

          <nav aria-label="Sections" className="order-3 flex w-full flex-1 basis-full gap-1 overflow-x-auto md:order-none md:w-auto md:basis-auto [scrollbar-width:none]">
            {TABS.filter(([, , onlyFor]) => !onlyFor || config?.isAdmin).map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-accent-soft font-semibold text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg'
                  )
                }
              >
                {label}
                {label === 'Today' && dueCount > 0 && (
                  <span className="rounded-full bg-warn-soft px-1.5 text-[11px] font-medium text-warn">{dueCount}</span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 text-[13px] text-muted">
            <span className="hidden sm:inline">{config?.user}</span>
            <Button size="sm" variant="primary" onClick={() => setAskOpen(true)} title="Ask about the app">
              Ask
            </Button>
            <Button size="sm" onClick={cycleTheme} title={`Theme: ${theme}`}>
              {theme === 'system' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light'}
            </Button>
            <Button size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-4 px-4 pb-16 pt-5">
        <JobBar />
        <Outlet />
      </main>

      {askOpen && <AssistantPanel onClose={() => setAskOpen(false)} />}
      <Toasts items={toasts} />
    </>
  );
}
