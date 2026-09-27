import { Hono } from 'hono';
import { db } from '../../db/client.js';
import * as schema from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export const adminAuthRouter = new Hono();

adminAuthRouter.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password required' }, 400);
  }

  const user = db
    .select()
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.email, body.email))
    .get();

  // In demo / initial setup, accept admin login or check simple hash
  if (!user || user.passwordHash !== body.password) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const expiresAt = Date.now() + 7 * 24 * 3600 * 1000; // 7 days

  db.insert(schema.sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt,
  }).run();

  c.header('Set-Cookie', `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
});

adminAuthRouter.post('/logout', (c) => {
  c.header('Set-Cookie', `session_id=; Path=/; HttpOnly; Max-Age=0`);
  return c.json({ success: true });
});
