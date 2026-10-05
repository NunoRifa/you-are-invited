import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { db } from '../../db/client.js';
import * as schema from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { guardTurnstile, clientIpFromHeaders } from '../../turnstile.js';
import type { AdminLoginInput } from '@you-are-invited/shared-types';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const adminAuthRouter = new Hono();

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, salt, expectedHex] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !expectedHex || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

function readSessionId(cookieHeader: string | undefined): string | undefined {
  return cookieHeader?.split(';').map((part) => part.trim()).find((part) => part.startsWith('session_id='))?.slice('session_id='.length);
}

function sessionCookie(sessionId: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

adminAuthRouter.post('/login', async (c) => {
  let body: AdminLoginInput;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  // Cloudflare Turnstile verification (server-side, fails closed) before any
  // credential work, so forged/stuffed requests never reach the password check.
  const turnstileRejection = await guardTurnstile({
    token: body.turnstileToken,
    action: 'admin-login',
    endpoint: 'POST /api/admin/login',
    remoteIp: clientIpFromHeaders(c.req.header('x-forwarded-for')),
  });
  if (turnstileRejection) {
    return c.json({ error: turnstileRejection.message }, turnstileRejection.status);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !body.password) return c.json({ error: 'Email and password required' }, 400);

  const user = db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, email)).get();
  if (!user || !verifyPassword(body.password, user.passwordHash)) return c.json({ error: 'Invalid credentials' }, 401);

  const sessionId = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.insert(schema.sessions).values({ id: sessionId, userId: user.id, expiresAt }).run();
  c.header('Set-Cookie', sessionCookie(sessionId, Math.floor(SESSION_TTL_MS / 1000)));
  return c.json({ success: true, user: { id: user.id, email: user.email, role: user.role } });
});

adminAuthRouter.get('/session', (c) => {
  const sessionId = readSessionId(c.req.header('Cookie'));
  if (!sessionId) return c.json({ error: 'Unauthenticated' }, 401);
  const session = db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId)).get();
  if (!session || session.expiresAt <= Date.now()) {
    if (session) db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
    c.header('Set-Cookie', sessionCookie('', 0));
    return c.json({ error: 'Session expired' }, 401);
  }
  const user = db.select().from(schema.adminUsers).where(eq(schema.adminUsers.id, session.userId)).get();
  if (!user) return c.json({ error: 'Unauthenticated' }, 401);
  return c.json({ success: true, user: { id: user.id, email: user.email, role: user.role } });
});

adminAuthRouter.post('/logout', (c) => {
  const sessionId = readSessionId(c.req.header('Cookie'));
  if (sessionId) db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
  c.header('Set-Cookie', sessionCookie('', 0));
  return c.json({ success: true });
});

export function requireAdminSession(cookieHeader: string | undefined): boolean {
  const sessionId = readSessionId(cookieHeader);
  if (!sessionId) return false;
  const session = db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId)).get();
  if (!session) return false;
  if (session.expiresAt <= Date.now()) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
    return false;
  }
  return Boolean(db.select().from(schema.adminUsers).where(eq(schema.adminUsers.id, session.userId)).get());
}
