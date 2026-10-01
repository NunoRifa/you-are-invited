import { Hono } from 'hono';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { eq, and, desc, lt, or } from 'drizzle-orm';
import type { CreateWishInput, Wish } from '@you-are-invited/shared-types';

export const wishesRouter = new Hono();

// Simple in-memory rate limiting map: ip -> lastSubmissionTimestamp
const rateLimitMap = new Map<string, number>();

// GET /api/invitations/:slug/wishes?cursor=&limit=10
wishesRouter.get('/:slug/wishes', (c) => {
  const slug = c.req.param('slug');
  const limit = Math.min(Number(c.req.query('limit')) || 10, 50);
  const cursor = c.req.query('cursor') ? Number(c.req.query('cursor')) : undefined;
  const cursorId = c.req.query('cursorId') || undefined;

  const inv = db
    .select({ id: schema.invitations.id })
    .from(schema.invitations)
    .where(eq(schema.invitations.slug, slug))
    .get();

  if (!inv) {
    return c.json({ error: 'Invitation not found' }, 404);
  }

  const query = db
    .select()
    .from(schema.wishes)
    .where(
      and(
        eq(schema.wishes.invitationId, inv.id),
        cursor ? or(
          lt(schema.wishes.createdAt, cursor),
          cursorId ? and(eq(schema.wishes.createdAt, cursor), lt(schema.wishes.id, cursorId)) : undefined
        ) : undefined
      )
    )
    .orderBy(desc(schema.wishes.createdAt), desc(schema.wishes.id))
    .limit(limit);

  const rows = query.all();

  const formatted: Wish[] = rows.map((w) => ({
    id: w.id,
    invitationId: w.invitationId,
    guestName: w.guestName,
    attendanceStatus: w.attendanceStatus as 'attending' | 'not_attending' | 'maybe',
    message: w.message,
    isHidden: w.isHidden,
    createdAt: w.createdAt,
  }));

  const nextCursor = formatted.length === limit ? {
    createdAt: formatted[formatted.length - 1].createdAt,
    id: formatted[formatted.length - 1].id,
  } : null;

  return c.json({
    data: formatted,
    nextCursor,
  });
});

// POST /api/invitations/:slug/wishes
wishesRouter.post('/:slug/wishes', async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.json<CreateWishInput>();

  // 1. Honeypot check
  if (body.website_hp && body.website_hp.trim() !== '') {
    // Silently reject or return 400
    return c.json({ error: 'Spam detected' }, 400);
  }

  // 2. Rate limit check (1 submission per 5 seconds per IP)
  const clientIp = c.req.header('x-forwarded-for') || '127.0.0.1';
  const now = Date.now();
  const lastTime = rateLimitMap.get(clientIp);
  if (lastTime && now - lastTime < 5000) {
    return c.json({ error: 'Terlalu sering mengirim ucapan. Harap tunggu beberapa detik.' }, 429);
  }
  rateLimitMap.set(clientIp, now);

  // 3. Validation
  const guestName = (body.guestName || '').trim();
  const message = (body.message || '').trim();
  const attendanceStatus = body.attendanceStatus || 'attending';

  if (!guestName || guestName.length < 2) {
    return c.json({ error: 'Nama minimal 2 karakter' }, 400);
  }

  if (!message || message.length < 2) {
    return c.json({ error: 'Pesan ucapan minimal 2 karakter' }, 400);
  }

  const validStatuses = ['attending', 'not_attending', 'maybe'];
  if (!validStatuses.includes(attendanceStatus)) {
    return c.json({ error: 'Status kehadiran tidak valid' }, 400);
  }

  const inv = db
    .select({ id: schema.invitations.id })
    .from(schema.invitations)
    .where(eq(schema.invitations.slug, slug))
    .get();

  if (!inv) {
    return c.json({ error: 'Invitation not found' }, 404);
  }

  const newWishId = `w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const inserted = {
    id: newWishId,
    invitationId: inv.id,
    guestName,
    attendanceStatus,
    message,
    isHidden: false,
    createdAt: now,
  };

  db.insert(schema.wishes).values(inserted).run();

  return c.json({
    success: true,
    data: inserted,
  }, 201);
});
