import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';

const tempDir = mkdtempSync(path.join(tmpdir(), 'yai-yt-publication-'));
const previousCwd = process.cwd();
const previousDatabaseUrl = process.env.DATABASE_URL;

process.env.DATABASE_URL = path.join(tempDir, 'test.sqlite');
process.chdir(tempDir);

let app: Hono;
let db: typeof import('../../db/client.js').db;
let sqlite: typeof import('../../db/client.js').sqlite;
let schema: typeof import('../../db/schema.js');

const cookie = (user: string) => ({ Cookie: `session_id=session-${user}` });
const jsonHeaders = (user: string) => ({ ...cookie(user), 'Content-Type': 'application/json' });

const validAttestations = {
  assetsLicensed: true,
  youtubeIdentityReviewed: true,
  visualParityChecked: true,
  linksVerified: true,
};

beforeAll(async () => {
  schema = await import('../../db/schema.js');
  ({ db, sqlite } = await import('../../db/client.js'));
  const { adminInvitationsRouter } = await import('./invitations.js');

  const now = Date.now();
  db.insert(schema.templates).values([
    { id: 'raden-motion', displayName: 'Raden Motion' },
    { id: 'yt-wedding', displayName: 'YouTube Wedding' },
  ]).run();

  db.insert(schema.adminUsers).values([
    { id: 'admin-root', email: 'root@example.test', passwordHash: 'unused', role: 'super_admin', createdAt: now },
    { id: 'user-yt', email: 'yt@example.test', passwordHash: 'unused', role: 'owner', createdAt: now },
  ]).run();

  db.insert(schema.sessions).values([
    { id: 'session-root', userId: 'admin-root', expiresAt: now + 600_000 },
    { id: 'session-yt', userId: 'user-yt', expiresAt: now + 600_000 },
  ]).run();

  db.insert(schema.invitations).values([
    {
      id: 'inv-yt',
      slug: 'riska-rafli',
      ownerUserId: 'user-yt',
      title: 'Riska & Rafli',
      templateKey: 'yt-wedding',
      isPublished: false,
      createdAt: now,
      updatedAt: 1000,
    },
  ]).run();

  app = new Hono();
  app.route('/api/admin/invitations', adminInvitationsRouter);
});

afterAll(() => {
  sqlite?.close();
  process.chdir(previousCwd);
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('Task 6: yt-wedding publication gates and admin controls', () => {
  it('1. Draft cannot be published without super_admin role (owner gets 403)', async () => {
    const res = await app.request('/api/admin/invitations/inv-yt/publication', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({
        isPublished: true,
        confirmation: 'PUBLISH',
        attestations: validAttestations,
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json() as { error?: string };
    expect(body.error).toMatch(/super admin/i);
  });

  it('2. Draft cannot be published without matching confirmation (400)', async () => {
    const res = await app.request('/api/admin/invitations/inv-yt/publication', {
      method: 'PATCH',
      headers: jsonHeaders('root'),
      body: JSON.stringify({
        isPublished: true,
        confirmation: 'WRONG_CONFIRMATION',
        attestations: validAttestations,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toMatch(/confirmation mismatch/i);
  });

  it('3. Draft cannot be published without complete attestations (422)', async () => {
    // Missing attestations object completely
    const resMissing = await app.request('/api/admin/invitations/inv-yt/publication', {
      method: 'PATCH',
      headers: jsonHeaders('root'),
      body: JSON.stringify({
        isPublished: true,
        confirmation: 'PUBLISH',
      }),
    });
    expect(resMissing.status).toBe(422);

    // One attestation is false
    const resPartial = await app.request('/api/admin/invitations/inv-yt/publication', {
      method: 'PATCH',
      headers: jsonHeaders('root'),
      body: JSON.stringify({
        isPublished: true,
        confirmation: 'PUBLISH',
        attestations: {
          ...validAttestations,
          linksVerified: false,
        },
      }),
    });
    expect(resPartial.status).toBe(422);
    const bodyPartial = await resPartial.json() as { error?: string };
    expect(bodyPartial.error).toMatch(/attestation/i);
  });

  it('4. Draft cannot be published with missing couple data, missing events, or placeholder mapsUrl (422 with reasons)', async () => {
    // Currently inv-yt has 0 couples, 0 events, no cover photo
    const res = await app.request('/api/admin/invitations/inv-yt/publication', {
      method: 'PATCH',
      headers: jsonHeaders('root'),
      body: JSON.stringify({
        isPublished: true,
        confirmation: 'riska-rafli',
        attestations: validAttestations,
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as { error?: string; reasons?: string[] };
    expect(body.error).toBe('Publication requirements unmet');
    expect(Array.isArray(body.reasons)).toBe(true);
    expect(body.reasons?.some((r) => /couple/i.test(r))).toBe(true);
    expect(body.reasons?.some((r) => /event/i.test(r))).toBe(true);
    expect(body.reasons?.some((r) => /cover photo/i.test(r))).toBe(true);

    // Insert 2 couples, 1 event with placeholder mapsUrl, and cover photo
    db.insert(schema.invitationAssets).values({
      id: 'ast-cover-1',
      invitationId: 'inv-yt',
      kind: 'image',
      storagePath: 'storage/uploads/inv-yt/cover.jpg',
      mimeType: 'image/jpeg',
      originalFilename: 'cover.jpg',
      createdAt: Date.now(),
    }).run();

    db.update(schema.invitations)
      .set({ coverPhotoAssetId: 'ast-cover-1' })
      .where(eq(schema.invitations.id, 'inv-yt'))
      .run();

    db.insert(schema.couples).values([
      { id: 'cp-1', invitationId: 'inv-yt', role: 'bride', fullName: 'Riska Alvionita', displayName: 'Riska' },
      { id: 'cp-2', invitationId: 'inv-yt', role: 'groom', fullName: 'Muhammad Rafli', displayName: 'Rafli' },
    ]).run();

    db.insert(schema.events).values([
      {
        id: 'ev-1',
        invitationId: 'inv-yt',
        label: 'Akad Nikah',
        date: '2026-12-12',
        startTime: '08:00',
        venueName: 'Masjid Agung',
        venueAddress: 'Jl. Merdeka No. 1',
        mapsUrl: 'https:///#',
        sortOrder: 0,
      },
    ]).run();

    // Still fails because mapsUrl is placeholder
    const resMapsPlaceholder = await app.request('/api/admin/invitations/inv-yt/publication', {
      method: 'PATCH',
      headers: jsonHeaders('root'),
      body: JSON.stringify({
        isPublished: true,
        confirmation: 'riska-rafli',
        attestations: validAttestations,
      }),
    });

    expect(resMapsPlaceholder.status).toBe(422);
    const bodyMaps = await resMapsPlaceholder.json() as { error?: string; reasons?: string[] };
    expect(bodyMaps.reasons?.some((r) => /mapsUrl/i.test(r))).toBe(true);
  });

  it('4b. Draft cannot be published with missing couple photos, missing quotes, or missing closing text (422)', async () => {
    // Fix mapsUrl so it does not fail on mapsUrl
    db.update(schema.events)
      .set({ mapsUrl: 'https://maps.google.com/?q=Masjid+Agung' })
      .where(eq(schema.events.id, 'ev-1'))
      .run();

    const res = await app.request('/api/admin/invitations/inv-yt/publication', {
      method: 'PATCH',
      headers: jsonHeaders('root'),
      body: JSON.stringify({
        isPublished: true,
        confirmation: 'riska-rafli',
        attestations: validAttestations,
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as { error?: string; reasons?: string[] };
    expect(body.reasons?.some((r) => /photo asset/i.test(r))).toBe(true);
    expect(body.reasons?.some((r) => /quote/i.test(r))).toBe(true);
    expect(body.reasons?.some((r) => /closing text/i.test(r))).toBe(true);
  });

  it('4c. Draft cannot be published with invalid event date or start time format (422)', async () => {
    // Set invalid date (February 31) and invalid time
    db.update(schema.events)
      .set({ date: '2026-02-31', startTime: '25:70' })
      .where(eq(schema.events.id, 'ev-1'))
      .run();

    const res = await app.request('/api/admin/invitations/inv-yt/publication', {
      method: 'PATCH',
      headers: jsonHeaders('root'),
      body: JSON.stringify({
        isPublished: true,
        confirmation: 'riska-rafli',
        attestations: validAttestations,
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as { error?: string; reasons?: string[] };
    expect(body.reasons?.some((r) => /calendar date/i.test(r))).toBe(true);
    expect(body.reasons?.some((r) => /start time/i.test(r))).toBe(true);

    // Restore valid event date and time
    db.update(schema.events)
      .set({ date: '2026-12-12', startTime: '08:00' })
      .where(eq(schema.events.id, 'ev-1'))
      .run();
  });

  it('4d. Draft cannot be published if gallery is enabled but has no images (422)', async () => {
    const res = await app.request('/api/admin/invitations/inv-yt/publication', {
      method: 'PATCH',
      headers: jsonHeaders('root'),
      body: JSON.stringify({
        isPublished: true,
        confirmation: 'riska-rafli',
        attestations: validAttestations,
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json() as { error?: string; reasons?: string[] };
    expect(body.reasons?.some((r) => /gallery/i.test(r))).toBe(true);
  });

  it('5. Draft publishes successfully when super_admin provides confirmation, all attestations, and valid content', async () => {
    // Provide couple photo assets belonging to this invitation
    db.insert(schema.invitationAssets).values([
      {
        id: 'ast-bride-1',
        invitationId: 'inv-yt',
        kind: 'image',
        storagePath: 'storage/uploads/inv-yt/bride.jpg',
        mimeType: 'image/jpeg',
        originalFilename: 'bride.jpg',
        createdAt: Date.now(),
      },
      {
        id: 'ast-groom-1',
        invitationId: 'inv-yt',
        kind: 'image',
        storagePath: 'storage/uploads/inv-yt/groom.jpg',
        mimeType: 'image/jpeg',
        originalFilename: 'groom.jpg',
        createdAt: Date.now(),
      },
      {
        id: 'ast-gallery-1',
        invitationId: 'inv-yt',
        kind: 'image',
        storagePath: 'storage/uploads/inv-yt/gallery1.jpg',
        mimeType: 'image/jpeg',
        originalFilename: 'gallery1.jpg',
        createdAt: Date.now(),
      },
    ]).run();

    db.update(schema.couples).set({ photoAssetId: 'ast-bride-1' }).where(eq(schema.couples.id, 'cp-1')).run();
    db.update(schema.couples).set({ photoAssetId: 'ast-groom-1' }).where(eq(schema.couples.id, 'cp-2')).run();

    db.update(schema.invitations)
      .set({
        quoteText: 'Dan di antara tanda-tanda kebesaran-Nya...',
        quoteSource: 'QS. Ar-Rum: 21',
        closingText: 'Merupakan suatu kehormatan dan kebahagiaan bagi kami...',
      })
      .where(eq(schema.invitations.id, 'inv-yt'))
      .run();

    db.insert(schema.galleryImages).values({
      id: 'gal-1',
      invitationId: 'inv-yt',
      assetId: 'ast-gallery-1',
      sortOrder: 0,
    }).run();

    const publishTimeBefore = Date.now();
    const res = await app.request('/api/admin/invitations/inv-yt/publication', {
      method: 'PATCH',
      headers: jsonHeaders('root'),
      body: JSON.stringify({
        isPublished: true,
        confirmation: 'PUBLISH',
        attestations: validAttestations,
      }),
    });

    expect(res.status).toBe(200);
    const resBody = await res.json() as { success: boolean; isPublished: boolean };
    expect(resBody.success).toBe(true);
    expect(resBody.isPublished).toBe(true);

    const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, 'inv-yt')).get()!;
    expect(inv.isPublished).toBe(true);
    expect(inv.updatedAt).toBeGreaterThanOrEqual(publishTimeBefore);

    // Approval record stored in invitation_template_fields under yt_publication_approval
    const approvalField = db.select().from(schema.invitationTemplateFields)
      .where(and(
        eq(schema.invitationTemplateFields.invitationId, 'inv-yt'),
        eq(schema.invitationTemplateFields.fieldKey, 'yt_publication_approval'),
      ))
      .get();

    expect(approvalField).toBeDefined();
    const approval = JSON.parse(approvalField!.fieldValue);
    expect(approval.actorId).toBe('admin-root');
    expect(approval.attestations).toEqual(validAttestations);
    expect(approval.invitationUpdatedAt).toBe(inv.updatedAt);
    expect(approval.timestamp).toBeGreaterThanOrEqual(publishTimeBefore);
  });

  it('6. Content update changes updatedAt and marks publication approval revision as stale', async () => {
    // Wait small tick to ensure timestamp increases
    await new Promise((r) => setTimeout(r, 10));

    const updateRes = await app.request('/api/admin/invitations/inv-yt/yt-wedding', {
      method: 'PATCH',
      headers: jsonHeaders('root'),
      body: JSON.stringify({
        heroCaption: 'Updated Hero Caption',
      }),
    });
    expect(updateRes.status).toBe(200);

    const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, 'inv-yt')).get()!;
    const approvalField = db.select().from(schema.invitationTemplateFields)
      .where(and(
        eq(schema.invitationTemplateFields.invitationId, 'inv-yt'),
        eq(schema.invitationTemplateFields.fieldKey, 'yt_publication_approval'),
      ))
      .get()!;

    const approval = JSON.parse(approvalField.fieldValue);
    // updatedAt has moved forward beyond the approval record
    expect(inv.updatedAt).toBeGreaterThan(approval.invitationUpdatedAt);
    // approval is marked stale
    expect(approval.stale).toBe(true);
  });

  it('7. Unpublish (isPublished: false) succeeds immediately without attestations by owner or super_admin', async () => {
    const res = await app.request('/api/admin/invitations/inv-yt/publication', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({
        isPublished: false,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; isPublished: boolean };
    expect(body.success).toBe(true);
    expect(body.isPublished).toBe(false);

    const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, 'inv-yt')).get()!;
    expect(inv.isPublished).toBe(false);
  });

  it('8. Generic PATCH cannot toggle isPublished', async () => {
    const res = await app.request('/api/admin/invitations/inv-yt', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({
        isPublished: true,
        title: 'Updated Title Via Generic Patch',
      }),
    });

    expect(res.status).toBe(200);

    const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, 'inv-yt')).get()!;
    // Title updated, but isPublished remained false!
    expect(inv.title).toBe('Updated Title Via Generic Patch');
    expect(inv.isPublished).toBe(false);
  });
});
