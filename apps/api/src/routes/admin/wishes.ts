import { Hono } from 'hono';
import { db } from '../../db/client.js';
import * as schema from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

export const adminWishesRouter = new Hono();

// PATCH /api/admin/invitations/:id/wishes/:wishId (moderate: hide/unhide)
adminWishesRouter.patch('/:id/wishes/:wishId', async (c) => {
  const invId = c.req.param('id');
  const wishId = c.req.param('wishId');
  const body = await c.req.json<{ isHidden: boolean }>();

  const updated = db
    .update(schema.wishes)
    .set({ isHidden: Boolean(body.isHidden) })
    .where(and(eq(schema.wishes.id, wishId), eq(schema.wishes.invitationId, invId)))
    .run();

  if (updated.changes === 0) {
    return c.json({ error: 'Wish not found' }, 404);
  }

  return c.json({ success: true });
});

// DELETE /api/admin/invitations/:id/wishes/:wishId
adminWishesRouter.delete('/:id/wishes/:wishId', (c) => {
  const invId = c.req.param('id');
  const wishId = c.req.param('wishId');

  const deleted = db
    .delete(schema.wishes)
    .where(and(eq(schema.wishes.id, wishId), eq(schema.wishes.invitationId, invId)))
    .run();

  if (deleted.changes === 0) {
    return c.json({ error: 'Wish not found' }, 404);
  }

  return c.json({ success: true });
});

// GET /api/admin/invitations/:id/wishes/export (CSV export)
adminWishesRouter.get('/:id/wishes/export', (c) => {
  const invId = c.req.param('id');

  const list = db
    .select()
    .from(schema.wishes)
    .where(eq(schema.wishes.invitationId, invId))
    .all();

  // Generate CSV
  const header = ['ID', 'Nama Tamu', 'Kehadiran', 'Pesan', 'Status Disembunyikan', 'Waktu Kirim'];
  const rows = list.map((w) => [
    w.id,
    `"${w.guestName.replace(/"/g, '""')}"`,
    w.attendanceStatus,
    `"${w.message.replace(/"/g, '""')}"`,
    w.isHidden ? 'Ya' : 'Tidak',
    new Date(w.createdAt).toISOString(),
  ]);

  const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="guest-wishes-${invId}.csv"`,
    },
  });
});
