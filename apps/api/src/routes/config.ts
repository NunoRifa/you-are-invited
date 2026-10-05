import { Hono } from 'hono';
import { publicTurnstileConfig } from '../turnstile.js';

export const configRouter = new Hono();

// GET /api/config/turnstile — public. Exposes only the site key and whether the
// gate is active. The secret key never leaves the server.
configRouter.get('/turnstile', (c) => {
  return c.json(publicTurnstileConfig());
});
