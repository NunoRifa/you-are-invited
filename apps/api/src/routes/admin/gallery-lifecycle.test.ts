import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { PublicInvitationPayload } from '@you-are-invited/shared-types';

const tempDir = mkdtempSync(path.join(tmpdir(), 'yai-gallery-lifecycle-'));
const previousCwd = process.cwd();
const previousDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = path.join(tempDir, 'test.sqlite');
process.chdir(tempDir);

let app: Hono;
let db: typeof import('../../db/client.js').db;
let sqlite: typeof import('../../db/client.js').sqlite;
let schema: typeof import('../../db/schema.js');
let seedTemplates: typeof import('../../db/seed/templates.js').seedTemplates;
const invitationId = 'inv-riska-rafli';
const headers = (user = 'root') => ({ Cookie: `session_id=session-${user}`, 'Content-Type': 'application/json' });

async function preview() {
  const response = await app.request(`/api/admin/invitations/${invitationId}/preview/data`, { headers: headers() });
  expect(response.status).toBe(200);
  return response.json() as Promise<PublicInvitationPayload>;
}

async function uploadImage(id = invitationId) {
  const body = new FormData();
  body.append('file', new File([Buffer.from([0xff, 0xd8, 0xff, 0xe0])], 'gallery.jpg', { type: 'image/jpeg' }));
  body.append('kind', 'image');
  const response = await app.request(`/api/admin/invitations/${id}/assets`, {
    method: 'POST', headers: { Cookie: 'session_id=session-root' }, body,
  });
  expect(response.status).toBe(201);
  return (await response.json() as { id: string }).id;
}

function addImage(assetId: string, id = invitationId, user = 'root') {
  return app.request(`/api/admin/invitations/${id}/gallery`, {
    method: 'POST', headers: headers(user), body: JSON.stringify({ assetId }),
  });
}

async function settings(id = invitationId) {
  const response = await app.request(`/api/admin/invitations/${id}`, { headers: headers() });
  expect(response.status).toBe(200);
  return (await response.json() as { templateFields: Array<{ id: string; fieldKey: string; fieldValue: string }> }).templateFields;
}

beforeAll(async () => {
  schema = await import('../../db/schema.js');
  ({ db, sqlite } = await import('../../db/client.js'));
  ({ seedTemplates } = await import('../../db/seed/templates.js'));
  const { adminInvitationsRouter } = await import('./invitations.js');
  const now = Date.now();
  db.insert(schema.adminUsers).values([
    { id: 'root', email: 'root@example.test', passwordHash: 'unused', role: 'super_admin', createdAt: now },
    { id: 'other', email: 'other@example.test', passwordHash: 'unused', role: 'owner', createdAt: now },
  ]).run();
  db.insert(schema.sessions).values([
    { id: 'session-root', userId: 'root', expiresAt: now + 600_000 },
    { id: 'session-other', userId: 'other', expiresAt: now + 600_000 },
  ]).run();
  await seedTemplates();
  app = new Hono();
  app.route('/api/admin/invitations', adminInvitationsRouter);
});

beforeEach(() => {
  db.delete(schema.galleryImages).where(eq(schema.galleryImages.invitationId, invitationId)).run();
  db.delete(schema.invitationTemplateFields).where(eq(schema.invitationTemplateFields.invitationId, invitationId)).run();
});

afterAll(() => {
  sqlite?.close();
  process.chdir(previousCwd);
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('seeded gallery visibility lifecycle', () => {
  it('preserves historical explicit hide that PATCH stored on the unmarked legacy seed row', async () => {
    const assetId = await uploadImage();
    expect((await addImage(assetId)).status).toBe(201);
    // Historical PATCH updated this seed row in place, without a source marker.
    db.insert(schema.invitationTemplateFields).values({
      id: 'tf-riska-yt-show-gallery', invitationId, fieldKey: 'yt_show_gallery', fieldValue: 'true',
    }).run();
    db.update(schema.invitationTemplateFields).set({ fieldValue: 'false' })
      .where(eq(schema.invitationTemplateFields.id, 'tf-riska-yt-show-gallery')).run();
    const hiddenSettings = await settings();
    await seedTemplates();
    expect(await settings()).toEqual(hiddenSettings);
    expect((await addImage(assetId)).status).toBe(201);
    expect(await settings()).toEqual(hiddenSettings);
    expect((await preview()).templateFields.yt_show_gallery).toBe('false');
    await seedTemplates();
    expect(await settings()).toEqual(hiddenSettings);
  });

  it.each([
    { id: 'tf-riska-yt-show-gallery', source: undefined, expected: 'false' },
    { id: 'auto-existing-gallery', source: 'auto', expected: 'true' },
    { id: 'tf-riska-yt-show-gallery', source: 'manual', expected: 'false' },
    { id: 'operator-existing-gallery', source: undefined, expected: 'false' },
  ])('reconciles three existing gallery images on startup for $id with source $source', async ({ id, source, expected }) => {
    const assetId = await uploadImage();
    for (let index = 0; index < 3; index++) expect((await addImage(assetId)).status).toBe(201);
    db.insert(schema.invitationTemplateFields).values({
      id, invitationId, fieldKey: 'yt_show_gallery', fieldValue: 'false',
    }).run();
    if (source) db.insert(schema.invitationTemplateFields).values({
      id: 'startup-visibility-source', invitationId, fieldKey: 'yt_gallery_visibility_source', fieldValue: source,
    }).run();
    const originalSettings = await settings();
    await seedTemplates();
    const payload = await preview();
    expect(payload.templateFields.yt_show_gallery).toBe(expected);
    expect(payload.gallery).toHaveLength(3);
    if (expected === 'false') expect(await settings()).toEqual(originalSettings);
    else expect(await settings()).toContainEqual(expect.objectContaining({
      fieldKey: 'yt_gallery_visibility_source', fieldValue: 'auto',
    }));
    const reconciledSettings = await settings();
    await seedTemplates();
    expect(await settings()).toEqual(reconciledSettings);
  });

  it.each([
    { id: 'tf-riska-yt-show-gallery', source: undefined, expected: 'false' },
    { id: 'operator-hidden-gallery', source: undefined, expected: 'false' },
    { id: 'tf-riska-yt-show-gallery', source: 'manual', expected: 'false' },
    { id: 'another-auto-gallery', source: 'auto', expected: 'true' },
  ])('respects legacy visibility row $id with source $source', async ({ id, source, expected }) => {
    db.insert(schema.invitationTemplateFields).values({
      id, invitationId, fieldKey: 'yt_show_gallery', fieldValue: 'false',
    }).run();
    if (source) db.insert(schema.invitationTemplateFields).values({
      id: 'test-visibility-source', invitationId, fieldKey: 'yt_gallery_visibility_source', fieldValue: source,
    }).run();
    const originalSettings = await settings();
    await seedTemplates();
    expect(await settings()).toEqual(originalSettings);
    const response = await app.request(`/api/admin/invitations/${invitationId}/yt-wedding`, {
      method: 'PATCH', headers: headers(), body: JSON.stringify({ galleryIntro: 'Our photos' }),
    });
    expect(response.status).toBe(200);
    expect((await addImage(await uploadImage())).status).toBe(201);
    expect((await preview()).templateFields.yt_show_gallery).toBe(expected);
  });

  it('marks both explicit show and hide as manual, without changing other fields on restart', async () => {
    await seedTemplates();
    for (const showGallery of [true, false]) {
      const response = await app.request(`/api/admin/invitations/${invitationId}/yt-wedding`, {
        method: 'PATCH', headers: headers(), body: JSON.stringify({ showGallery }),
      });
      expect(response.status).toBe(200);
      const fields = await settings();
      expect(fields).toContainEqual(expect.objectContaining({ fieldKey: 'yt_show_gallery', fieldValue: String(showGallery) }));
      expect(fields).toContainEqual(expect.objectContaining({ fieldKey: 'yt_gallery_visibility_source', fieldValue: 'manual' }));
      await seedTemplates();
      expect(await settings()).toEqual(fields);
    }
  });

  it('rejects invalid and unauthorized writes without changing gallery visibility or unrelated clients', async () => {
    await seedTemplates();
    const before = await settings();
    const anggiBefore = await settings('inv-anggi-ivan');
    const assetId = await uploadImage();
    const foreignAssetId = await uploadImage('inv-anggi-ivan');
    expect((await addImage(foreignAssetId)).status).toBe(400);
    expect((await addImage('missing-asset')).status).toBe(400);
    expect((await addImage(assetId, invitationId, 'other')).status).toBe(404);
    const unauthenticated = await app.request(`/api/admin/invitations/${invitationId}/gallery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId }),
    });
    expect(unauthenticated.status).toBe(401);
    const forbiddenPatch = await app.request(`/api/admin/invitations/${invitationId}/yt-wedding`, {
      method: 'PATCH', headers: headers('other'), body: JSON.stringify({ showGallery: true }),
    });
    expect(forbiddenPatch.status).toBe(404);
    const invalidPatch = await app.request(`/api/admin/invitations/${invitationId}/yt-wedding`, {
      method: 'PATCH', headers: headers(), body: JSON.stringify({ showGallery: 'false' }),
    });
    expect(invalidPatch.status).toBe(400);
    expect(await settings()).toEqual(before);
    expect((await preview()).gallery).toHaveLength(0);
    expect((await addImage(assetId)).status).toBe(201);
    expect(await settings('inv-anggi-ivan')).toEqual(anggiBefore);
    // Generic templates must not gain yt-wedding visibility settings when adding their own image.
    expect((await addImage(foreignAssetId, 'inv-anggi-ivan')).status).toBe(201);
    expect(await settings('inv-anggi-ivan')).toEqual(anggiBefore);
  });

  it('rolls back gallery insertion when its visibility update fails', async () => {
    await seedTemplates();
    const before = await settings();
    const assetId = await uploadImage();
    sqlite.exec(`CREATE TRIGGER fail_gallery_visibility BEFORE UPDATE ON invitation_template_fields
      WHEN NEW.field_key = 'yt_show_gallery'
      BEGIN SELECT RAISE(ABORT, 'test visibility failure'); END`);
    try {
      expect((await addImage(assetId)).status).toBe(500);
      expect((await preview()).gallery).toHaveLength(0);
      expect(await settings()).toEqual(before);
    } finally {
      sqlite.exec('DROP TRIGGER fail_gallery_visibility');
    }
  });

  it.each(['auto', 'legacy'])('keeps explicit admin hide on the %s seed row after upload and restart', async (source) => {
    await seedTemplates();
    if (source === 'legacy') {
      db.delete(schema.invitationTemplateFields)
        .where(eq(schema.invitationTemplateFields.id, 'tf-riska-yt-gallery-visibility-source')).run();
    }
    const response = await app.request(`/api/admin/invitations/${invitationId}/yt-wedding`, {
      method: 'PATCH', headers: headers(), body: JSON.stringify({ showGallery: false }),
    });
    expect(response.status).toBe(200);
    expect((await addImage(await uploadImage())).status).toBe(201);
    expect((await preview()).templateFields.yt_show_gallery).toBe('false');
    expect(await settings()).toContainEqual(expect.objectContaining({
      fieldKey: 'yt_gallery_visibility_source', fieldValue: 'manual',
    }));
    const hiddenSettings = await settings();
    await seedTemplates();
    expect(await settings()).toEqual(hiddenSettings);
  });

  it('shows real uploaded images after auto-hidden seed, including delete-all and re-add across restarts', async () => {
    await seedTemplates();
    expect((await preview()).templateFields.yt_show_gallery).toBe('false');
    const assetId = await uploadImage();
    const added = await addImage(assetId);
    expect(added.status).toBe(201);
    const { id: galleryId } = await added.json() as { id: string };
    expect((await preview()).templateFields.yt_show_gallery).toBe('true');
    expect(await settings()).toContainEqual(expect.objectContaining({
      fieldKey: 'yt_gallery_visibility_source', fieldValue: 'auto',
    }));
    const visibleSettings = await settings();
    await seedTemplates();
    expect(await settings()).toEqual(visibleSettings);

    const removed = await app.request(`/api/admin/invitations/${invitationId}/gallery/${galleryId}`, {
      method: 'DELETE', headers: headers(),
    });
    expect(removed.status).toBe(200);
    await seedTemplates();
    expect((await addImage(assetId)).status).toBe(201);
    const payload = await preview();
    expect(payload.templateFields.yt_show_gallery).toBe('true');
    expect(payload.gallery).toHaveLength(1);
  });
});
