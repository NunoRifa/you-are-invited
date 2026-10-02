import { Hono } from 'hono';
import { db } from '../../db/client.js';
import * as schema from '../../db/schema.js';
import { eq, desc } from 'drizzle-orm';

export const adminInvitationsRouter = new Hono();

// GET /api/admin/invitations
adminInvitationsRouter.get('/', (c) => {
  const list = db
    .select()
    .from(schema.invitations)
    .orderBy(desc(schema.invitations.createdAt))
    .all();

  return c.json(list);
});

// GET /api/admin/invitations/:id
adminInvitationsRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, id)).get();
  if (!inv) {
    return c.json({ error: 'Invitation not found' }, 404);
  }

  const couples = db.select().from(schema.couples).where(eq(schema.couples.invitationId, id)).all();
  const events = db.select().from(schema.events).where(eq(schema.events.invitationId, id)).all();
  const fields = db.select().from(schema.invitationTemplateFields).where(eq(schema.invitationTemplateFields.invitationId, id)).all();
  const livestream = db.select().from(schema.livestreamInfo).where(eq(schema.livestreamInfo.invitationId, id)).get();

  return c.json({
    invitation: inv,
    couples,
    events,
    templateFields: fields,
    livestream: livestream || null,
  });
});

// PATCH /api/admin/invitations/:id/livestream
adminInvitationsRouter.patch('/:id/livestream', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ streamUrl?: string; date?: string; timeLabel?: string; label?: string }>();

  const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, id)).get();
  if (!inv) {
    return c.json({ error: 'Invitation not found' }, 404);
  }

  const existing = db.select().from(schema.livestreamInfo).where(eq(schema.livestreamInfo.invitationId, id)).get();
  if (existing) {
    db.update(schema.livestreamInfo)
      .set(body)
      .where(eq(schema.livestreamInfo.id, existing.id))
      .run();
  } else {
    db.insert(schema.livestreamInfo).values({
      id: `ls-${Date.now()}`,
      invitationId: id,
      label: body.label || 'Wedding Live',
      date: body.date || '',
      timeLabel: body.timeLabel || '',
      streamUrl: body.streamUrl || '',
    }).run();
  }

  return c.json({ success: true });
});

// PATCH /api/admin/invitations/:id
adminInvitationsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Partial<typeof schema.invitations.$inferInsert>>();

  const updated = db
    .update(schema.invitations)
    .set({
      ...body,
      updatedAt: Date.now(),
    })
    .where(eq(schema.invitations.id, id))
    .run();

  if (updated.changes === 0) {
    return c.json({ error: 'Invitation not found' }, 404);
  }

  return c.json({ success: true });
});
