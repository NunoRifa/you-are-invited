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

  return c.json({
    invitation: inv,
    couples,
    events,
    templateFields: fields,
  });
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
