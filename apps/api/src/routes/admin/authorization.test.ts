import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';

const tempDir = mkdtempSync(path.join(tmpdir(), 'yai-authorization-'));
const previousCwd = process.cwd();
const previousDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = path.join(tempDir, 'test.sqlite');
process.chdir(tempDir);

let app: Hono;
let db: typeof import('../../db/client.js').db;
let sqlite: typeof import('../../db/client.js').sqlite;
let schema: typeof import('../../db/schema.js');
const cookie = (user: string) => ({ Cookie: `session_id=session-${user}` });
const json = (user: string) => ({ ...cookie(user), 'Content-Type': 'application/json' });
const request = (user: string, url: string, method = 'GET', body?: unknown) => app.request(`/api/admin/invitations${url}`, {
  method, headers: body === undefined ? cookie(user) : json(user),
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

beforeAll(async () => {
  schema = await import('../../db/schema.js');
  ({ db, sqlite } = await import('../../db/client.js'));
  const { adminInvitationsRouter } = await import('./invitations.js');
  const { adminWishesRouter } = await import('./wishes.js');
  db.insert(schema.templates).values({ id: 'theme', displayName: 'Theme' }).run();
  db.insert(schema.adminUsers).values(['a', 'b', 'root'].map((id) => ({ id, email: `${id}@example.test`, passwordHash: 'unused', role: id === 'root' ? 'super_admin' as const : 'owner' as const, createdAt: Date.now() }))).run();
  db.insert(schema.sessions).values(['a', 'b', 'root'].map((id) => ({ id: `session-${id}`, userId: id, expiresAt: Date.now() + 600_000 }))).run();
  db.insert(schema.invitations).values(['a', 'b', 'legacy'].map((id) => ({ id: `inv-${id}`, slug: `slug-${id}`, ownerUserId: id === 'legacy' ? null : id, title: `Title ${id}`, templateKey: 'theme', createdAt: Date.now(), updatedAt: Date.now() }))).run();
  db.insert(schema.invitationAssets).values(['a', 'b'].map((id) => ({ id: `asset-${id}`, invitationId: `inv-${id}`, kind: 'image' as const, storagePath: path.join(tempDir, `${id}.jpg`), mimeType: 'image/jpeg', originalFilename: `${id}.jpg`, createdAt: Date.now() }))).run();
  db.insert(schema.couples).values(['a', 'b'].map((id) => ({ id: `couple-${id}`, invitationId: `inv-${id}`, role: 'bride' as const, fullName: id, displayName: id }))).run();
  db.insert(schema.events).values(['a', 'b'].map((id) => ({ id: `event-${id}`, invitationId: `inv-${id}`, label: id, date: '2026-11-02', startTime: '10:00', venueName: id, venueAddress: id }))).run();
  db.insert(schema.wishes).values(['a', 'b'].map((id) => ({ id: `wish-${id}`, invitationId: `inv-${id}`, guestName: id, message: id, createdAt: Date.now() }))).run();
  app = new Hono();
  app.route('/api/admin/invitations', adminInvitationsRouter);
  app.route('/api/admin/invitations', adminWishesRouter);
});

afterAll(() => {
  sqlite?.close();
  process.chdir(previousCwd);
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('admin invitation ownership', () => {
  it('limits owner lists and reads, including unowned invitations; super admin sees all', async () => {
    expect((await (await request('a', '')).json() as { id: string }[]).map((item) => item.id)).toEqual(['inv-a']);
    expect((await request('a', '/inv-a')).status).toBe(200);
    expect((await request('a', '/inv-b')).status).toBe(404);
    expect((await request('a', '/inv-legacy')).status).toBe(404);
    expect((await (await request('root', '')).json() as { id: string }[]).map((item) => item.id)).toEqual(expect.arrayContaining(['inv-a', 'inv-b', 'inv-legacy']));
    expect((await request('root', '/inv-b')).status).toBe(200);
    expect((await request('root', '/inv-legacy')).status).toBe(200);
    expect((await app.request('/api/admin/invitations/inv-a')).status).toBe(401);
  });

  it('blocks foreign writes and nested resource IDs without side effects', async () => {
    const forbidden = [
      request('b', '/inv-a', 'PATCH', { title: 'stolen' }),
      request('b', '/inv-a/events', 'POST', { label: 'stolen', date: '2026-11-02', startTime: '10:00', venueName: 'stolen', venueAddress: 'stolen' }),
      request('b', '/inv-a/couples/couple-a', 'PATCH', { displayName: 'stolen' }),
      request('b', '/inv-a/assets/asset-a', 'DELETE'),
      request('b', '/inv-a/wishes/wish-a', 'DELETE'),
      request('b', '/inv-a/wishes/export'),
      request('a', '/inv-a/events/event-b', 'PATCH', { label: 'stolen' }),
      request('a', '/inv-a/wishes/wish-b', 'PATCH', { isHidden: true }),
    ];
    for (const response of await Promise.all(forbidden)) expect(response.status).toBe(404);
    expect(db.select().from(schema.invitations).where(eq(schema.invitations.id, 'inv-a')).get()?.title).toBe('Title a');
    expect(db.select().from(schema.couples).where(eq(schema.couples.id, 'couple-a')).get()?.displayName).toBe('a');
    expect(db.select().from(schema.wishes).where(eq(schema.wishes.id, 'wish-a')).get()).toBeTruthy();
    expect(db.select().from(schema.events).where(eq(schema.events.id, 'event-b')).get()?.label).toBe('b');
  });

  it('blocks foreign uploads, gallery references, and couple photo references', async () => {
    const form = new FormData();
    form.append('file', new File([Buffer.from([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' }));
    expect((await app.request('/api/admin/invitations/inv-a/assets', { method: 'POST', headers: cookie('b'), body: form })).status).toBe(404);
    expect((await request('a', '/inv-a/gallery', 'POST', { assetId: 'asset-b' })).status).toBe(400);
    expect((await request('a', '/inv-a/couples/couple-a', 'PATCH', { photoAssetId: 'asset-b' })).status).toBe(400);
    expect(db.select().from(schema.couples).where(eq(schema.couples.id, 'couple-a')).get()?.photoAssetId).toBeNull();
  });

  it('rejects foreign image references and nested invitation reassignment', async () => {
    expect((await request('a', '/inv-a', 'PATCH', { coverPhotoAssetId: 'asset-b' })).status).toBe(400);
    expect((await request('a', '/inv-a', 'PATCH', { heroPhotoAssetId: 'asset-b' })).status).toBe(400);
    expect((await request('a', '/inv-a', 'PATCH', { closingPhotoAssetId: 'asset-b' })).status).toBe(400);
    expect((await request('a', '/inv-a/couples/couple-a', 'PATCH', { invitationId: 'inv-b', displayName: 'reassigned' })).status).toBe(200);
    expect(db.select().from(schema.couples).where(eq(schema.couples.id, 'couple-a')).get()).toMatchObject({ invitationId: 'inv-a', displayName: 'reassigned' });
  });

  it('allows owners and super admin to edit permitted invitations, without changing ownership or template', async () => {
    expect((await request('a', '/inv-a', 'PATCH', { title: 'Updated', ownerUserId: 'b', templateKey: 'forged' })).status).toBe(200);
    const stored = db.select().from(schema.invitations).where(eq(schema.invitations.id, 'inv-a')).get();
    expect(stored).toMatchObject({ title: 'Updated', ownerUserId: 'a', templateKey: 'theme' });
    expect((await request('root', '/inv-b', 'PATCH', { title: 'Admin updated' })).status).toBe(200);
    expect(db.select().from(schema.invitations).where(eq(schema.invitations.id, 'inv-b')).get()?.title).toBe('Admin updated');
  });
});
