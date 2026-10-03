import React, { useEffect, useState } from 'react';
import { LandingPage } from './routes/landing/index.js';
import { AdminDashboard } from './routes/admin/index.js';
import { InvitationEditor } from './routes/admin/editor.js';
import { AdminLogin } from './routes/admin/login.js';
import { useCallback } from 'react';

export function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(window.location.pathname);
  }, []);
  const logout = useCallback(async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    setAdminAuthenticated(false);
    setCurrentPath(window.location.pathname);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nextPath = window.location.pathname;
      if (!nextPath.startsWith('/admin')) setAdminAuthenticated(false);
      setCurrentPath(nextPath);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // /i/:slug is served directly by the Vite plugin (dev) and Nginx (prod)
  // as the ORIGINAL template HTML — see vite-plugin-invitation.ts.
  // See CLAUDE.md: "Zero Visual Modification to Templates".

  // Admin access is intentionally re-authenticated after every full page load.
  if (currentPath.startsWith('/admin')) {
    if (!adminAuthenticated) {
      return <AdminLogin returnTo={window.location.pathname + window.location.search} onLogin={() => setAdminAuthenticated(true)} />;
    }

    const editorMatch = currentPath.match(/^\/admin\/invitations\/([^/]+)$/);
    if (editorMatch) {
      return <InvitationEditor invitationId={decodeURIComponent(editorMatch[1])} onNavigate={navigate} onLogout={logout} />;
    }
    return <AdminDashboard onNavigate={navigate} onLogout={logout} />;
  }

  // Default to landing page
  return <LandingPage />;
}

export default App;
