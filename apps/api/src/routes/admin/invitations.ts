import { randomUUID } from 'node:crypto';
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
  const giftAccounts = db.select().from(schema.giftAccounts).where(eq(schema.giftAccounts.invitationId, id)).all();
  const wishes = db.select().from(schema.wishes).where(eq(schema.wishes.invitationId, id)).all();
  const fields = db.select().from(schema.invitationTemplateFields).where(eq(schema.invitationTemplateFields.invitationId, id)).all();
  const livestream = db.select().from(schema.livestreamInfo).where(eq(schema.livestreamInfo.invitationId, id)).get();

  return c.json({
    invitation: inv,
    couples,
    events,
    giftAccounts,
    wishes,
    templateFields: fields,
    livestream: livestream || null,
  });
});

// Update a couple within an invitation.
adminInvitationsRouter.patch('/:id/couples/:coupleId', async (c) => {
  const invitationId = c.req.param('id');
  const coupleId = c.req.param('coupleId');
  const body = await c.req.json<Partial<Pick<typeof schema.couples.$inferInsert, 'fullName' | 'displayName' | 'fatherName' | 'motherName' | 'birthOrderLabel' | 'instagramHandle'>>>();
  const couple = db.select().from(schema.couples).where(eq(schema.couples.id, coupleId)).get();
  if (!couple || couple.invitationId !== invitationId) return c.json({ error: 'Couple not found' }, 404);
  db.update(schema.couples).set(body).where(eq(schema.couples.id, coupleId)).run();
  return c.json({ success: true });
});

// Create an event within an invitation.
adminInvitationsRouter.post('/:id/events', async (c) => {
  const invitationId = c.req.param('id');
  let body: {
    label?: string;
    date?: string;
    startTime?: string;
    endTimeLabel?: string;
    venueName?: string;
    venueAddress?: string;
    mapsUrl?: string;
    sortOrder?: number;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }
  const invitation = db.select().from(schema.invitations).where(eq(schema.invitations.id, invitationId)).get();
  if (!invitation) return c.json({ error: 'Invitation not found' }, 404);
  if (!body.label?.trim() || !body.date?.trim() || !body.startTime?.trim() || !body.venueName?.trim() || !body.venueAddress?.trim()) {
    return c.json({ error: 'label, date, startTime, venueName, and venueAddress are required' }, 400);
  }
  const id = `ev-${randomUUID()}`;
  db.insert(schema.events).values({
    id,
    invitationId,
    label: body.label.trim(),
    date: body.date.trim(),
    startTime: body.startTime.trim(),
    endTimeLabel: body.endTimeLabel?.trim() || '',
    venueName: body.venueName.trim(),
    venueAddress: body.venueAddress.trim(),
    mapsUrl: body.mapsUrl?.trim() || '',
    sortOrder: body.sortOrder ?? 0,
  }).run();
  return c.json({ id }, 201);
});

// Update an event within an invitation.
adminInvitationsRouter.patch('/:id/events/:eventId', async (c) => {
  const invitationId = c.req.param('id');
  const eventId = c.req.param('eventId');
  const body = await c.req.json<Partial<Pick<typeof schema.events.$inferInsert, 'label' | 'date' | 'startTime' | 'endTimeLabel' | 'venueName' | 'venueAddress' | 'mapsUrl' | 'sortOrder'>>>();
  const event = db.select().from(schema.events).where(eq(schema.events.id, eventId)).get();
  if (!event || event.invitationId !== invitationId) return c.json({ error: 'Event not found' }, 404);
  db.update(schema.events).set(body).where(eq(schema.events.id, eventId)).run();
  return c.json({ success: true });
});

// Delete an event within an invitation.
adminInvitationsRouter.delete('/:id/events/:eventId', (c) => {
  const invitationId = c.req.param('id');
  const eventId = c.req.param('eventId');
  const event = db.select().from(schema.events).where(eq(schema.events.id, eventId)).get();
  if (!event || event.invitationId !== invitationId) return c.json({ error: 'Event not found' }, 404);
  db.delete(schema.events).where(eq(schema.events.id, eventId)).run();
  return c.json({ success: true });
});

// Create or update a gift account for an invitation.
adminInvitationsRouter.post('/:id/gift-accounts', async (c) => {
  const invitationId = c.req.param('id');
  let body: { holderName?: string; accountNumber?: string; providerName?: string; sortOrder?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }
  const invitation = db.select().from(schema.invitations).where(eq(schema.invitations.id, invitationId)).get();
  if (!invitation) return c.json({ error: 'Invitation not found' }, 404);
  if (!body.holderName?.trim() || !body.accountNumber?.trim() || !body.providerName?.trim()) {
    return c.json({ error: 'holderName, accountNumber and providerName are required' }, 400);
  }
  const id = `gf-${randomUUID()}`;
  db.insert(schema.giftAccounts).values({
    id,
    invitationId,
    holderName: body.holderName.trim(),
    accountNumber: body.accountNumber.trim(),
    providerName: body.providerName.trim(),
    sortOrder: body.sortOrder ?? 0,
  }).run();
  return c.json({ id }, 201);
});

adminInvitationsRouter.patch('/:id/gift-accounts/:accountId', async (c) => {
  const invitationId = c.req.param('id');
  const accountId = c.req.param('accountId');
  let body: Partial<Pick<typeof schema.giftAccounts.$inferInsert, 'holderName' | 'accountNumber' | 'providerName' | 'sortOrder'>>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }
  const account = db.select().from(schema.giftAccounts)
    .where(eq(schema.giftAccounts.id, accountId)).get();
  if (!account || account.invitationId !== invitationId) return c.json({ error: 'Gift account not found' }, 404);
  const update: Partial<typeof schema.giftAccounts.$inferInsert> = {};
  if (body.holderName !== undefined) update.holderName = body.holderName.trim();
  if (body.accountNumber !== undefined) update.accountNumber = body.accountNumber.trim();
  if (body.providerName !== undefined) update.providerName = body.providerName.trim();
  if (body.sortOrder !== undefined) update.sortOrder = body.sortOrder;
  if (Object.keys(update).length === 0) return c.json({ error: 'No editable fields provided' }, 400);
  if ((update.holderName !== undefined && !update.holderName) || (update.accountNumber !== undefined && !update.accountNumber) || (update.providerName !== undefined && !update.providerName)) {
    return c.json({ error: 'Gift account fields cannot be empty' }, 400);
  }
  db.update(schema.giftAccounts).set(update).where(eq(schema.giftAccounts.id, accountId)).run();
  return c.json({ success: true });
});

adminInvitationsRouter.delete('/:id/gift-accounts/:accountId', (c) => {
  const invitationId = c.req.param('id');
  const accountId = c.req.param('accountId');
  const account = db.select().from(schema.giftAccounts)
    .where(eq(schema.giftAccounts.id, accountId)).get();
  if (!account || account.invitationId !== invitationId) return c.json({ error: 'Gift account not found' }, 404);
  db.delete(schema.giftAccounts).where(eq(schema.giftAccounts.id, accountId)).run();
  return c.json({ success: true });
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
