import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { invitationsRouter } from './routes/invitations.js';
import { wishesRouter } from './routes/wishes.js';
import { templatesRouter } from './routes/templates.js';
import { adminAuthRouter } from './routes/admin/auth.js';
import { adminInvitationsRouter } from './routes/admin/invitations.js';
import { adminWishesRouter } from './routes/admin/wishes.js';
import { seedTemplates } from './db/seed/templates.js';
import dotenv from 'dotenv';

dotenv.config();

const app = new Hono();

// Middleware
app.use('*', cors({
  origin: (origin) => origin || '*',
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

// Admin Routes
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
