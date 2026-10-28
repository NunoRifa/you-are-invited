import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';

const tempDir = mkdtempSync(path.join(tmpdir(), 'yai-preview-'));
const previousCwd = process.cwd();
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousPageDir = process.env.INVITATION_PAGE_DIR;
process.env.DATABASE_URL = path.join(tempDir, 'test.sqlite');
process.chdir(tempDir);

let app: Hono;
let sqlite: typeof import('../db/client.js').sqlite;
let db: typeof import('../db/client.js').db;
let schema: typeof import('../db/schema.js');

beforeAll(async () => {
  schema = await import('../db/schema.js');
  ({ db, sqlite } = await import('../db/client.js'));
  const { invitationPageRouter } = await import('./invitation-page.js');
  db.insert(schema.templates).values({ id: 'raden-motion', displayName: 'Raden Motion' }).run();
  const now = Date.now();
  db.insert(schema.invitations).values([
    { id: 'anggi', slug: 'anggi-ivan', title: 'Pernikahan Anggi & Ivan', coupleDisplayName: 'Anggi & Ivan', templateKey: 'raden-motion', createdAt: now, updatedAt: now },
    { id: 'other', slug: 'other-couple', title: 'Pernikahan Lain', coupleDisplayName: 'Sari & Budi', templateKey: 'raden-motion', createdAt: now, updatedAt: now },
    { id: 'draft', slug: 'draft', title: 'Draft', templateKey: 'raden-motion', isPublished: false, createdAt: now, updatedAt: now },
  ]).run();
  mkdirSync(path.join(tempDir, 'pages', 'production', 'anggi-ivan'), { recursive: true });
  mkdirSync(path.join(tempDir, 'pages', 'templates', 'raden-motion'), { recursive: true });
  const fixture = '<!doctype html><html><head><title>You Are Invited Premium</title><link rel="canonical" href="/template-assets/webinvite.id/raden-motion/"><meta name="description" content="Template description"><meta name="robots" content="noindex, nofollow"><meta property="og:title" content="You Are Invited Premium"><meta property="og:description" content="Template description"><meta property="og:image" content="/template-assets/Mockup-Raden-link.jpg"><meta property="og:url" content="/template-assets/webinvite.id/raden-motion/"><meta property="og:site_name" content="Web Invite"><meta property="og:type" content="article"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="/template-assets/Mockup-Raden-link.jpg"></head><body>raden-engine</body></html>';
  writeFileSync(path.join(tempDir, 'pages', 'production', 'anggi-ivan', 'index.html'), fixture);
  writeFileSync(path.join(tempDir, 'pages', 'templates', 'raden-motion', 'index.html'), fixture);
  process.env.INVITATION_PAGE_DIR = path.join(tempDir, 'pages');
  db.insert(schema.invitationAssets).values([
    { id: 'anggi-cover', invitationId: 'anggi', kind: 'image', storagePath: 'anggi.png', mimeType: 'image/png', originalFilename: 'anggi.png', createdAt: now },
    { id: 'other-cover', invitationId: 'other', kind: 'image', storagePath: 'other.png', mimeType: 'image/png', originalFilename: 'other.png', createdAt: now },
  ]).run();
  db.update(schema.invitations).set({ coverPhotoAssetId: 'anggi-cover' }).where(eq(schema.invitations.id, 'anggi')).run();
  db.update(schema.invitations).set({ coverPhotoAssetId: 'other-cover' }).where(eq(schema.invitations.id, 'other')).run();
  app = new Hono();
  app.route('/i', invitationPageRouter);
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

it('returns client metadata in initial HTML for personalized and plain URLs', async () => {
  for (const suffix of ['', '?to=Nuno%20Rigo%20F']) {
    const response = await app.request('/i/anggi-ivan' + suffix);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<title>Undangan Pernikahan Anggi &amp; Ivan</title>');
    expect(html).toContain('content="https://you-are-invited.my.id/api/assets/anggi-cover"');
    expect(html).toContain('href="https://you-are-invited.my.id/i/anggi-ivan"');
    expect(html).toContain('content="https://you-are-invited.my.id/i/anggi-ivan"');
    expect(html).toContain('Dengan penuh kebahagiaan, Anggi &amp; Ivan mengundang Anda');
    expect(html).not.toContain('Mockup-Raden-link.jpg');
    expect(html).not.toContain('noindex, nofollow');
    expect((html.match(/<meta property="og:title"/g) || []).length).toBe(1);
    expect(html).not.toContain('Nuno Rigo F');
    expect(html).toContain('raden-engine');
  }
});

it('isolates other clients and refuses unpublished or missing invitations', async () => {
  const response = await app.request('/i/other-couple?to=%3Cscript%3E');
  const html = await response.text();
  expect(response.status).toBe(200);
  expect(html).toContain('Undangan Pernikahan Sari &amp; Budi');
  expect(html).toContain('https://you-are-invited.my.id/api/assets/other-cover');
  expect(html).not.toContain('Anggi &amp; Ivan');
  expect(html).not.toContain('<script>&lt;script&gt;');
  expect((await app.request('/i/draft')).status).toBe(404);
  expect((await app.request('/i/missing')).status).toBe(404);
});

it('escapes stored metadata and ignores another invitation’s asset', async () => {
  db.update(schema.invitations).set({ coupleDisplayName: 'A&B <test>', coverPhotoAssetId: 'other-cover' }).where(eq(schema.invitations.id, 'anggi')).run();
  const html = await (await app.request('/i/anggi-ivan')).text();
  expect(html).toContain('Undangan Pernikahan A&amp;B &lt;test&gt;');
  expect(html).not.toContain('api/assets/other-cover');
});
