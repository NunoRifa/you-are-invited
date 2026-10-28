import { afterAll, beforeAll, expect, it } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';

const directory = mkdtempSync(path.join(tmpdir(), 'yai-preview-fallback-'));
const previousCwd = process.cwd();
const previousDb = process.env.DATABASE_URL;
const previousPages = process.env.INVITATION_PAGE_DIR;
process.env.DATABASE_URL = path.join(directory, 'test.sqlite');
process.chdir(directory);
let app: Hono;
let sqlite: typeof import('../db/client.js').sqlite;

beforeAll(async () => {
  const schema = await import('../db/schema.js');
  const { db, sqlite: connection } = await import('../db/client.js');
  sqlite = connection;
  const { invitationPageRouter } = await import('./invitation-page.js');
  db.insert(schema.templates).values({ id: 'raden-motion', displayName: 'Raden' }).run();
  db.insert(schema.invitations).values({ id: 'demo', slug: 'raden-motion', title: 'Pernikahan Raden & Ayu', templateKey: 'raden-motion', createdAt: 1, updatedAt: 1 }).run();
  const pages = path.join(directory, 'pages');
  mkdirSync(path.join(pages, 'templates', 'raden-motion'), { recursive: true });
  mkdirSync(path.join(pages, 'template-assets', 'webinvite.id', 'wp-content', 'uploads'), { recursive: true });
  writeFileSync(path.join(pages, 'template-assets', 'webinvite.id', 'wp-content', 'uploads', 'demo.jpg'), 'fixture');
  writeFileSync(path.join(pages, 'templates', 'raden-motion', 'index.html'), '<html><head><meta\n property="og:image"\n content="/template-assets/webinvite.id/wp-content/uploads/demo.jpg"\n><meta name="twitter:image" content="/template-assets/webinvite.id/wp-content/uploads/demo.jpg"></head><body>demo</body></html>');
  process.env.INVITATION_PAGE_DIR = pages;
  app = new Hono();
  app.route('/i', invitationPageRouter);
});

afterAll(() => {
  sqlite?.close(); process.chdir(previousCwd);
  if (previousDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDb;
  if (previousPages === undefined) delete process.env.INVITATION_PAGE_DIR; else process.env.INVITATION_PAGE_DIR = previousPages;
  rmSync(directory, { recursive: true, force: true });
});

it('keeps a local template preview when client has no cover', async () => {
  const response = await app.request('/i/raden-motion');
  const html = await response.text();
  expect(response.status).toBe(200);
  expect(html).toContain('property="og:image" content="https://you-are-invited.my.id/template-assets/webinvite.id/wp-content/uploads/demo.jpg"');
  expect(html).toContain('name="twitter:image" content="https://you-are-invited.my.id/template-assets/webinvite.id/wp-content/uploads/demo.jpg"');
});
