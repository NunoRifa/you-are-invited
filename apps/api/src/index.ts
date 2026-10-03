import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { invitationsRouter } from './routes/invitations.js';
import { wishesRouter } from './routes/wishes.js';
import { templatesRouter } from './routes/templates.js';
import { adminAuthRouter, requireAdminSession } from './routes/admin/auth.js';
import { adminInvitationsRouter } from './routes/admin/invitations.js';
import { adminWishesRouter } from './routes/admin/wishes.js';
import { seedTemplates } from './db/seed/templates.js';
import dotenv from 'dotenv';

dotenv.config();

const app = new Hono();

// Middleware
const allowedOrigins = new Set([
  'http://localhost:5173',
  ...(process.env.WEB_ORIGIN ? [process.env.WEB_ORIGIN] : []),
]);
app.use('*', cors({
  origin: (origin) => origin && allowedOrigins.has(origin) ? origin : null,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// Public Routes
app.route('/api/templates', templatesRouter);
app.route('/api/invitations', invitationsRouter);
app.route('/api/invitations', wishesRouter);

// Register protection before admin routes so it runs for every management request.
app.use('/api/admin/*', async (c, next) => {
  if (c.req.path === '/api/admin/login' || c.req.path === '/api/admin/logout' || c.req.path === '/api/admin/session') return next();
  if (!requireAdminSession(c.req.header('Cookie'))) return c.json({ error: 'Unauthenticated' }, 401);
  return next();
});
app.route('/api/admin', adminAuthRouter);
app.route('/api/admin/invitations', adminInvitationsRouter);
app.route('/api/admin/invitations', adminWishesRouter);

// Auto-seed templates and initial demo invitations on startup if db is empty
seedTemplates().catch(console.error);

const port = Number(process.env.PORT) || 3000;
console.log(`Backend server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
