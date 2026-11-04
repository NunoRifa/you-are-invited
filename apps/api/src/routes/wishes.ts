import { Hono } from 'hono';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { eq, and, desc, lt, or } from 'drizzle-orm';
import { guardTurnstile, clientIpFromHeaders } from '../turnstile.js';
import type { CreateWishInput, Wish } from '@you-are-invited/shared-types';

export const wishesRouter = new Hono();

// Simple in-memory rate limiting map: ip -> lastSubmissionTimestamp
const rateLimitMap = new Map<string, number>();

function isValidStreamUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

// GET /api/invitations/:slug/wishes?cursor=&limit=10
wishesRouter.get('/:slug/wishes', (c) => {
  const slug = c.req.param('slug');
  const limit = Math.min(Number(c.req.query('limit')) || 10, 50);
  const cursor = c.req.query('cursor') ? Number(c.req.query('cursor')) : undefined;
  const cursorId = c.req.query('cursorId') || undefined;

  const inv = db
    .select({ id: schema.invitations.id, isPublished: schema.invitations.isPublished })
    .from(schema.invitations)
    .where(eq(schema.invitations.slug, slug))
    .get();

  if (!inv || !inv.isPublished) {
    return c.json({ error: 'Invitation not found' }, 404);
  }

  const query = db
    .select()
    .from(schema.wishes)
    .where(
      and(
        eq(schema.wishes.invitationId, inv.id),
        eq(schema.wishes.isHidden, false),
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
    attendanceChannel: (w.attendanceChannel as 'offline' | 'online' | null) ?? null,
    guestCount: w.guestCount ?? 1,
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

  // 3. Cloudflare Turnstile verification (server-side, fails closed).
  //    Inserted after the existing honeypot/rate-limit so their behavior is
  //    unchanged, and before field validation so spam is rejected early.
  const turnstileRejection = await guardTurnstile({
    token: body.turnstileToken,
    action: 'wishes',
    endpoint: 'POST /api/invitations/:slug/wishes',
    remoteIp: clientIpFromHeaders(c.req.header('x-forwarded-for')),
  });
  if (turnstileRejection) {
    return c.json({ error: turnstileRejection.message }, turnstileRejection.status);
  }

  // 4. Validation
  const inv = db
    .select({
      id: schema.invitations.id,
      templateKey: schema.invitations.templateKey,
      isPublished: schema.invitations.isPublished,
    })
    .from(schema.invitations)
    .where(eq(schema.invitations.slug, slug))
    .get();

  if (!inv || !inv.isPublished) {
    return c.json({ error: 'Invitation not found' }, 404);
  }

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

  let attendanceChannel: 'offline' | 'online' | null = null;
  let guestCount = 1;

  if (inv.templateKey === 'yt-wedding') {
    if (attendanceStatus === 'attending') {
      if (body.attendanceChannel !== 'offline' && body.attendanceChannel !== 'online') {
        return c.json({ error: "Channel kehadiran harus dipilih ('offline' atau 'online')" }, 400);
      }
      attendanceChannel = body.attendanceChannel;

      if (attendanceChannel === 'online') {
        const livestream = db
          .select({ streamUrl: schema.livestreamInfo.streamUrl })
          .from(schema.livestreamInfo)
          .where(eq(schema.livestreamInfo.invitationId, inv.id))
          .get();

        if (!isValidStreamUrl(livestream?.streamUrl)) {
          return c.json({ error: 'Live streaming belum tersedia untuk undangan ini' }, 400);
        }
        guestCount = 1;
      } else {
        const pax = body.guestCount;
        if (typeof pax !== 'number' || !Number.isInteger(pax) || pax < 1 || pax > 10) {
          return c.json({ error: 'Jumlah tamu harus bilangan bulat antara 1 dan 10' }, 400);
        }
        guestCount = pax;
      }
    } else {
      guestCount = 1;
      attendanceChannel = null;
    }
  } else {
    if (body.attendanceChannel === 'offline' || body.attendanceChannel === 'online') {
      attendanceChannel = body.attendanceChannel;
    }
    if (typeof body.guestCount === 'number' && Number.isInteger(body.guestCount) && body.guestCount >= 1 && body.guestCount <= 10) {
      guestCount = body.guestCount;
    } else {
      guestCount = 1;
    }
  }

  const newWishId = `w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const inserted = {
    id: newWishId,
    invitationId: inv.id,
    guestName,
    attendanceStatus: attendanceStatus as 'attending' | 'not_attending' | 'maybe',
    attendanceChannel,
    guestCount,
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
