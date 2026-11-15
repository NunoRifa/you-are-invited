import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';

const tempDir = mkdtempSync(path.join(tmpdir(), 'yai-draft-'));
const previousCwd = process.cwd();
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousPageDir = process.env.INVITATION_PAGE_DIR;
process.env.DATABASE_URL = path.join(tempDir, 'test.sqlite');
process.chdir(tempDir);

let app: Hono;
let db: typeof import('../db/client.js').db;
let sqlite: typeof import('../db/client.js').sqlite;
let schema: typeof import('../db/schema.js');

const cookie = (user: string) => ({ Cookie: `session_id=session-${user}` });
const json = (user: string) => ({ ...cookie(user), 'Content-Type': 'application/json' });

beforeAll(async () => {
  schema = await import('../db/schema.js');
  ({ db, sqlite } = await import('../db/client.js'));
  const { invitationPageRouter } = await import('./invitation-page.js');
  const { invitationsRouter } = await import('./invitations.js');
  const { assetsRouter } = await import('./assets.js');
  const { adminInvitationsRouter } = await import('./admin/invitations.js');
  const { getAdminActor } = await import('./admin/authorization.js');

  const now = Date.now();
  db.insert(schema.templates).values([
    { id: 'raden-motion', displayName: 'Raden Motion' },
    { id: 'yt-wedding', displayName: 'YT Wedding' },
  ]).run();

  db.insert(schema.adminUsers).values([
    { id: 'owner-a', email: 'owner-a@example.com', passwordHash: 'hash', role: 'owner', createdAt: now },
    { id: 'owner-b', email: 'owner-b@example.com', passwordHash: 'hash', role: 'owner', createdAt: now },
    { id: 'super-admin', email: 'super@example.com', passwordHash: 'hash', role: 'super_admin', createdAt: now },
  ]).run();

  db.insert(schema.sessions).values([
    { id: 'session-owner-a', userId: 'owner-a', expiresAt: now + 3600_000 },
    { id: 'session-owner-b', userId: 'owner-b', expiresAt: now + 3600_000 },
    { id: 'session-super-admin', userId: 'super-admin', expiresAt: now + 3600_000 },
  ]).run();

  db.insert(schema.invitations).values([
    {
      id: 'anggi',
      slug: 'anggi-ivan',
      title: 'Pernikahan Anggi & Ivan',
      coupleDisplayName: 'Anggi & Ivan',
      templateKey: 'raden-motion',
      isPublished: true,
      ownerUserId: 'owner-a',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'draft-a',
      slug: 'draft-a',
      title: 'Draft A',
      coupleDisplayName: 'A & Partner',
      templateKey: 'raden-motion',
      isPublished: false,
      ownerUserId: 'owner-a',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'riska',
      slug: 'riska-rafli',
      title: 'Pernikahan Riska & Rafli',
      coupleDisplayName: 'Riska & Rafli',
      templateKey: 'yt-wedding',
      isPublished: false,
      ownerUserId: 'super-admin',
      createdAt: now,
      updatedAt: now,
    },
  ]).run();

  // Storage / disk setup
  const uploadsDir = path.join(tempDir, 'storage', 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  writeFileSync(path.join(uploadsDir, 'anggi.png'), Buffer.from('fake-anggi-png'));
  writeFileSync(path.join(uploadsDir, 'draft.png'), Buffer.from('fake-draft-png'));

  db.insert(schema.invitationAssets).values([
    { id: 'anggi-cover', invitationId: 'anggi', kind: 'image', storagePath: path.join(uploadsDir, 'anggi.png'), mimeType: 'image/png', originalFilename: 'anggi.png', createdAt: now },
    { id: 'draft-asset', invitationId: 'draft-a', kind: 'image', storagePath: path.join(uploadsDir, 'draft.png'), mimeType: 'image/png', originalFilename: 'draft.png', createdAt: now },
  ]).run();
  db.update(schema.invitations).set({ coverPhotoAssetId: 'anggi-cover' }).where(eq(schema.invitations.id, 'anggi')).run();
  db.update(schema.invitations).set({ coverPhotoAssetId: 'draft-asset' }).where(eq(schema.invitations.id, 'draft-a')).run();

  const pagesDir = path.join(tempDir, 'pages');
  process.env.INVITATION_PAGE_DIR = pagesDir;
  mkdirSync(path.join(pagesDir, 'production', 'anggi-ivan'), { recursive: true });
  mkdirSync(path.join(pagesDir, 'templates', 'raden-motion', 'assets'), { recursive: true });
  mkdirSync(path.join(pagesDir, 'templates', 'yt-wedding', 'assets', 'css'), { recursive: true });

  const htmlFixture = '<!doctype html><html><head><title>Original</title></head><body>Original Content</body></html>';
  writeFileSync(path.join(pagesDir, 'production', 'anggi-ivan', 'index.html'), htmlFixture);
  writeFileSync(path.join(pagesDir, 'templates', 'raden-motion', 'index.html'), htmlFixture);
  writeFileSync(path.join(pagesDir, 'templates', 'yt-wedding', 'index.html'), htmlFixture);

  writeFileSync(path.join(pagesDir, 'templates', 'raden-motion', 'assets', 'style.css'), '.raden { color: red; }');
  writeFileSync(path.join(pagesDir, 'templates', 'raden-motion', 'assets', 'script.js'), 'console.log("raden");');
  writeFileSync(path.join(pagesDir, 'templates', 'raden-motion', 'assets', 'secret.env'), 'SECRET_KEY=123');
  writeFileSync(path.join(pagesDir, 'templates', 'yt-wedding', 'assets', 'css', 'style.css'), '.yt { color: blue; }');

  app = new Hono();
  app.route('/i', invitationPageRouter);
  app.route('/api/invitations', invitationsRouter);
  app.route('/api/assets', assetsRouter);

  app.use('/api/admin/*', async (c, next) => {
    if (c.req.path === '/api/admin/login' || c.req.path === '/api/admin/logout' || c.req.path === '/api/admin/session') return next();
    if (!getAdminActor(c.req.header('Cookie'))) return c.json({ error: 'Unauthenticated' }, 401);
    return next();
  });
  app.route('/api/admin/invitations', adminInvitationsRouter);
});

afterAll(() => {
  sqlite?.close();
  process.chdir(previousCwd);
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  if (previousPageDir === undefined) delete process.env.INVITATION_PAGE_DIR;
  else process.env.INVITATION_PAGE_DIR = previousPageDir;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('Task 2: Draft isolation and preview', () => {
  describe('Requirement 5 & 6: Unpublished public routes return 404', () => {
    it('returns 404 for unpublished invitation on public HTML route, even with ?preview query', async () => {
      expect((await app.request('/i/draft-a')).status).toBe(404);
      expect((await app.request('/i/draft-a?preview=1')).status).toBe(404);
      expect((await app.request('/i/draft-a?preview=true')).status).toBe(404);
      expect((await app.request('/i/riska-rafli')).status).toBe(404);
      expect((await app.request('/i/riska-rafli?preview=1&to=%3Cscript%3E')).status).toBe(404);
      expect((await app.request('/i/riska-rafli/assets/js/bind.js')).status).toBe(404);
      expect((await app.request('/i/riska-rafli/assets/css/style.css')).status).toBe(404);
      expect((await app.request('/production/riska-rafli/index.html')).status).toBe(404);
      expect((await app.request('/templates/yt-wedding/index.html')).status).toBe(404);
    });

    it('returns 404 for unpublished invitation on public API route, even with ?preview query', async () => {
      expect((await app.request('/api/invitations/draft-a')).status).toBe(404);
      expect((await app.request('/api/invitations/draft-a?preview=1')).status).toBe(404);
      expect((await app.request('/api/invitations/riska-rafli')).status).toBe(404);
    });

    it('returns 404 for asset belonging to unpublished invitation when unauthenticated or foreign actor', async () => {
      // Unauthenticated
      expect((await app.request('/api/assets/draft-asset')).status).toBe(404);
      // Foreign actor (owner-b does not own draft-a)
      expect((await app.request('/api/assets/draft-asset', { headers: cookie('owner-b') })).status).toBe(404);
    });

    it('allows owner and super-admin to fetch asset of unpublished invitation with private no-store headers', async () => {
      const ownerRes = await app.request('/api/assets/draft-asset', { headers: cookie('owner-a') });
      expect(ownerRes.status).toBe(200);
      expect(ownerRes.headers.get('Cache-Control')).toContain('no-store');

      const superRes = await app.request('/api/assets/draft-asset', { headers: cookie('super-admin') });
      expect(superRes.status).toBe(200);
      expect(superRes.headers.get('Cache-Control')).toContain('no-store');
    });

    it('keeps existing published Anggi routes and assets functioning publicly with public caching', async () => {
      const pageRes = await app.request('/i/anggi-ivan');
      expect(pageRes.status).toBe(200);
      expect(pageRes.headers.get('Cache-Control')).toContain('public');

      const apiRes = await app.request('/api/invitations/anggi-ivan');
      expect(apiRes.status).toBe(200);
      const data = await apiRes.json() as any;
      expect(data.invitation.slug).toBe('anggi-ivan');
      expect(data.invitation.coverPhotoUrl).toBe('/api/assets/anggi-cover');
      expect(data.invitation.coverPhotoUrl).not.toContain('\\');
      expect((await app.request('/api/admin/invitations/riska/preview/data', { headers: cookie('owner-a') })).status).toBe(404);

      const assetRes = await app.request('/api/assets/anggi-cover');
      expect(assetRes.status).toBe(200);
      expect(assetRes.headers.get('Cache-Control')).toContain('public');
    });
  });

  it('admin editor read and save stays scoped to owner, with Riska invisible to Anggi owner', async () => {
    const own = await app.request('/api/admin/invitations/anggi', { headers: cookie('owner-a') });
    expect(own.status).toBe(200);
    const outsider = await app.request('/api/admin/invitations/riska', { headers: cookie('owner-a') });
    expect(outsider.status).toBe(404);
    const superRead = await app.request('/api/admin/invitations/riska', { headers: cookie('super-admin') });
    expect(superRead.status).toBe(200);
    const saved = await app.request('/api/admin/invitations/anggi', { method: 'PATCH', headers: json('owner-a'), body: JSON.stringify({ title: 'Anggi editor smoke' }) });
    expect(saved.status).toBe(200);
    expect(db.select().from(schema.invitations).where(eq(schema.invitations.id, 'anggi')).get()?.title).toBe('Anggi editor smoke');
    expect(db.select().from(schema.invitations).where(eq(schema.invitations.id, 'riska')).get()?.title).toBe('Pernikahan Riska & Rafli');
  });

  describe('Requirement 1: Authenticated draft preview route', () => {
    it('denies outsider and unauthenticated callers on GET /api/admin/invitations/:id/preview', async () => {
      // Unauthenticated -> 401
      expect((await app.request('/api/admin/invitations/draft-a/preview')).status).toBe(401);
      // Other owner -> 404 (invitation not accessible)
      expect((await app.request('/api/admin/invitations/draft-a/preview', { headers: cookie('owner-b') })).status).toBe(404);
      expect((await app.request('/api/admin/invitations/riska/preview/assets/js/bind.js')).status).toBe(401);
      expect((await app.request('/api/admin/invitations/riska/preview/assets/js/bind.js', { headers: cookie('owner-a') })).status).toBe(404);
    });

    it('serves private HTML to owner with private, no-store and noindex, nofollow headers', async () => {
      const res = await app.request('/api/admin/invitations/draft-a/preview', { headers: cookie('owner-a') });
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('private, no-store');
      expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
      const html = await res.text();
      expect(html).toContain('A &amp; Partner');
      expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    });

    it('serves private HTML to super-admin', async () => {
      const res = await app.request('/api/admin/invitations/riska/preview', { headers: cookie('super-admin') });
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('private, no-store');
      expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
      const html = await res.text();
      expect(html).toContain('Riska &amp; Rafli');
      expect(html).toContain('<base href="/api/admin/invitations/riska/preview/">');

      // Supports trailing slash on preview route
      const slashRes = await app.request('/api/admin/invitations/riska/preview/', { headers: cookie('super-admin') });
      expect(slashRes.status).toBe(200);
    });
  });

  describe('Requirement 2: Draft typed payload route', () => {
    it('denies unauthenticated and other owner on GET /api/admin/invitations/:id/preview/data', async () => {
      expect((await app.request('/api/admin/invitations/draft-a/preview/data')).status).toBe(401);
      expect((await app.request('/api/admin/invitations/draft-a/preview/data', { headers: cookie('owner-b') })).status).toBe(404);
    });

    it('returns draft typed invitation payload to owner', async () => {
      const res = await app.request('/api/admin/invitations/draft-a/preview/data', { headers: cookie('owner-a') });
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.invitation).toBeDefined();
      expect(data.invitation.slug).toBe('draft-a');
      expect(data.invitation.coupleDisplayName).toBe('A & Partner');
      expect(data.invitation.isPublished).toBe(false);
    });
  });

  describe('Requirement 3: Preview assets route with allowlist and traversal prevention', () => {
    it('denies unauthenticated and other owner on GET /api/admin/invitations/:id/preview/assets/:file', async () => {
      expect((await app.request('/api/admin/invitations/draft-a/preview/assets/style.css')).status).toBe(401);
      expect((await app.request('/api/admin/invitations/draft-a/preview/assets/style.css', { headers: cookie('owner-b') })).status).toBe(404);
    });

    it('serves allowlisted CSS and JS to owner with private, no-store headers', async () => {
      const cssRes = await app.request('/api/admin/invitations/draft-a/preview/assets/style.css', { headers: cookie('owner-a') });
      expect(cssRes.status).toBe(200);
      expect(cssRes.headers.get('Content-Type')).toContain('text/css');
      expect(cssRes.headers.get('Cache-Control')).toBe('private, no-store');
      expect(await cssRes.text()).toContain('.raden');

      const jsRes = await app.request('/api/admin/invitations/draft-a/preview/assets/script.js', { headers: cookie('owner-a') });
      expect(jsRes.status).toBe(200);
      expect(jsRes.headers.get('Content-Type')).toContain('javascript');
    });

    it('serves nested assets for yt-wedding template to super-admin', async () => {
      const res = await app.request('/api/admin/invitations/riska/preview/assets/css/style.css', { headers: cookie('super-admin') });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/css');
      expect(await res.text()).toContain('.yt');

      // Also serves under fallback alias /api/admin/invitations/:id/assets/:file
      const fallbackRes = await app.request('/api/admin/invitations/riska/assets/css/style.css', { headers: cookie('super-admin') });
      expect(fallbackRes.status).toBe(200);
      expect(fallbackRes.headers.get('Content-Type')).toContain('text/css');
    });

    it('rejects non-allowlisted files (.env)', async () => {
      const res = await app.request('/api/admin/invitations/draft-a/preview/assets/secret.env', { headers: cookie('owner-a') });
      expect(res.status).toBe(404);
    });

    it('rejects path traversal attempts on preview assets', async () => {
      const res1 = await app.request('/api/admin/invitations/draft-a/preview/assets/../../etc/passwd', { headers: cookie('owner-a') });
      expect([400, 404]).toContain(res1.status);

      const res2 = await app.request('/api/admin/invitations/draft-a/preview/assets/..%2f..%2fpackage.json', { headers: cookie('owner-a') });
      expect([400, 404]).toContain(res2.status);
    });
  });

  describe('Requirement 4: Published assets route strictly scoped', () => {
    it('serves template assets under /i/:slug/assets/:file only for published invitations', async () => {
      const pubRes = await app.request('/i/anggi-ivan/assets/style.css');
      expect(pubRes.status).toBe(200);
      expect(pubRes.headers.get('Content-Type')).toContain('text/css');

      const draftRes = await app.request('/i/draft-a/assets/style.css');
      expect(draftRes.status).toBe(404);
    });

    it('rejects path traversal and non-allowlisted files on published asset route', async () => {
      const traversal = await app.request('/i/anggi-ivan/assets/../../etc/passwd');
      expect([400, 404]).toContain(traversal.status);

      const secret = await app.request('/i/anggi-ivan/assets/secret.env');
      expect(secret.status).toBe(404);
    });
  });

  describe('Requirement 7: Publication endpoint and generic PATCH protection', () => {
    it('prevents generic PATCH from toggling isPublished', async () => {
      const res = await app.request('/api/admin/invitations/draft-a', {
        method: 'PATCH',
        headers: json('owner-a'),
        body: JSON.stringify({ isPublished: true, title: 'Updated Draft Title' }),
      });
      expect(res.status).toBe(200);
      const updated = db.select().from(schema.invitations).where(eq(schema.invitations.id, 'draft-a')).get();
      expect(updated?.title).toBe('Updated Draft Title');
      expect(updated?.isPublished).toBe(false);
    });

    it('requires confirmation to toggle publication via PATCH /api/admin/invitations/:id/publication', async () => {
      const res = await app.request('/api/admin/invitations/draft-a/publication', {
        method: 'PATCH',
        headers: json('owner-a'),
        body: JSON.stringify({ isPublished: true }),
      });
      expect(res.status).toBe(400);
    });

    it('allows owner to publish draft-a with matching confirmation', async () => {
      const res = await app.request('/api/admin/invitations/draft-a/publication', {
        method: 'PATCH',
        headers: json('owner-a'),
        body: JSON.stringify({ isPublished: true, confirmation: 'draft-a' }),
      });
      expect(res.status).toBe(200);
      const updated = db.select().from(schema.invitations).where(eq(schema.invitations.id, 'draft-a')).get();
      expect(updated?.isPublished).toBe(true);

      // Unpublish immediately
      const unpubRes = await app.request('/api/admin/invitations/draft-a/publication', {
        method: 'PATCH',
        headers: json('owner-a'),
        body: JSON.stringify({ isPublished: false, confirmation: 'draft-a' }),
      });
      expect(unpubRes.status).toBe(200);
      expect(db.select().from(schema.invitations).where(eq(schema.invitations.id, 'draft-a')).get()?.isPublished).toBe(false);
    });

    it('forbids regular owner from publishing riska-rafli', async () => {
      const res = await app.request('/api/admin/invitations/riska/publication', {
        method: 'PATCH',
        headers: json('owner-a'),
        body: JSON.stringify({ isPublished: true, confirmation: 'riska-rafli' }),
      });
      // owner-a does not own riska -> 404 from middleware or 403
      expect([403, 404]).toContain(res.status);
    });

    it('rejects super-admin publishing riska-rafli with invalid confirmation', async () => {
      const res = await app.request('/api/admin/invitations/riska/publication', {
        method: 'PATCH',
        headers: json('super-admin'),
        body: JSON.stringify({ isPublished: true, confirmation: 'wrong' }),
      });
      expect(res.status).toBe(400);
    });

    it('allows super-admin to publish riska-rafli with valid confirmation', async () => {
      const now = Date.now();
      db.insert(schema.invitationAssets).values([
        { id: 'riska-cover', invitationId: 'riska', kind: 'image', storagePath: path.join(tempDir, 'storage', 'uploads', 'draft.png'), mimeType: 'image/png', originalFilename: 'cover.png', createdAt: now },
        { id: 'riska-cp1', invitationId: 'riska', kind: 'image', storagePath: path.join(tempDir, 'storage', 'uploads', 'draft.png'), mimeType: 'image/png', originalFilename: 'cp1.png', createdAt: now },
        { id: 'riska-cp2', invitationId: 'riska', kind: 'image', storagePath: path.join(tempDir, 'storage', 'uploads', 'draft.png'), mimeType: 'image/png', originalFilename: 'cp2.png', createdAt: now },
        { id: 'riska-gal1', invitationId: 'riska', kind: 'image', storagePath: path.join(tempDir, 'storage', 'uploads', 'draft.png'), mimeType: 'image/png', originalFilename: 'gal1.png', createdAt: now },
      ]).run();
      db.insert(schema.couples).values([
        { id: 'c-r-1', invitationId: 'riska', role: 'bride', fullName: 'Riska Alvionita', displayName: 'Riska', photoAssetId: 'riska-cp1' },
        { id: 'c-r-2', invitationId: 'riska', role: 'groom', fullName: 'Muhammad Rafli', displayName: 'Rafli', photoAssetId: 'riska-cp2' },
      ]).run();
      db.insert(schema.events).values([
        { id: 'ev-r-1', invitationId: 'riska', label: 'Akad', date: '2026-12-12', startTime: '08:00', venueName: 'Venue', venueAddress: 'Address', mapsUrl: 'https://maps.google.com/?q=venue' },
      ]).run();
      db.insert(schema.galleryImages).values([
        { id: 'gal-r-1', invitationId: 'riska', assetId: 'riska-gal1', sortOrder: 0 },
      ]).run();
      db.update(schema.invitations).set({
        coverPhotoAssetId: 'riska-cover',
        quoteText: 'Quote text',
        quoteSource: 'Quote source',
        closingText: 'Closing text',
      }).where(eq(schema.invitations.id, 'riska')).run();

      const res = await app.request('/api/admin/invitations/riska/publication', {
        method: 'PATCH',
        headers: json('super-admin'),
        body: JSON.stringify({
          isPublished: true,
          confirmation: 'riska-rafli',
          attestations: {
            assetsLicensed: true,
            youtubeIdentityReviewed: true,
            visualParityChecked: true,
            linksVerified: true,
          },
        }),
      });
      expect(res.status).toBe(200);
      expect(db.select().from(schema.invitations).where(eq(schema.invitations.id, 'riska')).get()?.isPublished).toBe(true);

      // Restore to unpublished for subsequent tests
      await app.request('/api/admin/invitations/riska/publication', {
        method: 'PATCH',
        headers: json('super-admin'),
        body: JSON.stringify({ isPublished: false, confirmation: 'riska-rafli' }),
      });
      expect(db.select().from(schema.invitations).where(eq(schema.invitations.id, 'riska')).get()?.isPublished).toBe(false);
    });
  });
});
