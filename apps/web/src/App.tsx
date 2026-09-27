import React, { useEffect, useState } from 'react';
import { LandingPage } from './routes/landing/index.js';
import { AdminDashboard } from './routes/admin/index.js';

export function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // /i/:slug is served directly by the Vite plugin (dev) and Nginx (prod)
  // as the ORIGINAL template HTML — see vite-plugin-invitation.ts.
  // See CLAUDE.md: "Zero Visual Modification to Templates".

  // Match /admin
  if (currentPath.startsWith('/admin')) {
    return <AdminDashboard />;
  }

  // Default to landing page
  return <LandingPage />;
}

export default App;
