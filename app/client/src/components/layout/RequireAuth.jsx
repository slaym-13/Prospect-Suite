import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Spinner } from '../ui/Feedback';

/** Checks the session before rendering the app, so no page flashes before the redirect. */
export function RequireAuth({ children }) {
  const [state, setState] = useState({ checked: false, user: null });

  useEffect(() => {
    api
      .session()
      .then((s) => setState({ checked: true, user: s.user }))
      .catch(() => setState({ checked: true, user: null }));
  }, []);

  if (!state.checked) return <Spinner label="Checking your session…" />;
  if (!state.user) return <Navigate to="/login" replace />;
  return children;
}
