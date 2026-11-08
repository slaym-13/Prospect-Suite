import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './theme.css';

import { RequireAuth } from './components/layout/RequireAuth';
import { AppLayout } from './components/layout/AppLayout';
import { AppProvider } from './store/AppContext';

import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Today from './pages/Today';
import Companies from './pages/Companies';
import Pipeline from './pages/Pipeline';
import Outbox from './pages/Outbox';
import Settings from './pages/Settings';
import Admin from './pages/Admin';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          element={
            <RequireAuth>
              <AppProvider>
                <AppLayout />
              </AppProvider>
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="today" element={<Today />} />
          <Route path="companies" element={<Companies />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="outbox" element={<Outbox />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
