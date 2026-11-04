import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';

const tempDir = mkdtempSync(path.join(tmpdir(), 'yai-yt-page-'));
const previousCwd = process.cwd();
const previousDatabaseUrl = process.env.DATABASE_URL;
const previousPageDir = process.env.INVITATION_PAGE_DIR;
process.env.DATABASE_URL = path.join(tempDir, 'test.sqlite');
process.chdir(tempDir);

let app: Hono;
let db: typeof import('../db/client.js').db;
let sqlite: typeof import('../db/client.js').sqlite;
let schema: typeof import('../db/schema.js');
let renderInvitationHtml: typeof import('./invitation-page.js').renderInvitationHtml;

const templateHtmlWithPlaceholders = `<!DOCTYPE html>
<html lang="id" data-bride="Juliet" data-groom="Romeo">
<!-- Mirrored from https://chara.id/yt-wedding/ by HTTrack Website Copier/3.x [XR&CO], Sat, 31 Oct 2026 18:08:08 GMT -->
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Undangan Pernikahan (YouTube Theme)</title>
    <meta name="author" content="chara.id">
    <meta name="description" content="Juliet & Romeo Wedding on Chara.id">
    <meta property="og:title" content="Juliet & Romeo">
    <meta property="og:description" content="Chara.id YouTube Theme">
    <meta property="og:image" content="https://chara.id/yt-wedding/assets/img/og-juliet-romeo.jpg">
    <meta property="og:url" content="https://chara.id/yt-wedding/">
    <link rel="canonical" href="https://chara.id/yt-wedding/">
</head>
<body>
    <div id="content">Template Body</div>
</body>
</html>`;

beforeAll(async () => {
  schema = await import('../db/schema.js');
  ({ db, sqlite } = await import('../db/client.js'));
  const invPage = await import('./invitation-page.js');
  renderInvitationHtml = invPage.renderInvitationHtml;

  const now = Date.now();
  db.insert(schema.templates).values([
    { id: 'yt-wedding', displayName: 'YT Wedding' },
    { id: 'raden-motion', displayName: 'Raden Motion' },
  ]).run();

  db.insert(schema.invitations).values([
    {
      id: 'inv-riska-published',
      slug: 'riska-rafli',
      title: 'Pernikahan Riska & Rafli',
      coupleDisplayName: 'Riska & Rafli',
      templateKey: 'yt-wedding',
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'inv-riska-draft',
      slug: 'riska-draft',
      title: 'Pernikahan Riska & Rafli (Draft)',
      coupleDisplayName: 'Riska & Rafli',
      templateKey: 'yt-wedding',
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'inv-anggi',
      slug: 'anggi-ivan',
      title: 'Pernikahan Anggi & Ivan',
      coupleDisplayName: 'Anggi & Ivan',
      templateKey: 'raden-motion',
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
  ]).run();

  const uploadsDir = path.join(tempDir, 'storage', 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  writeFileSync(path.join(uploadsDir, 'riska-cover.png'), Buffer.from('riska-image'));
  writeFileSync(path.join(uploadsDir, 'anggi-cover.png'), Buffer.from('anggi-image'));

  db.insert(schema.invitationAssets).values([
    {
      id: 'asset-riska-cover',
      invitationId: 'inv-riska-published',
      kind: 'image',
      storagePath: path.join(uploadsDir, 'riska-cover.png'),
      mimeType: 'image/png',
      originalFilename: 'riska-cover.png',
      createdAt: now,
    },
    {
      id: 'asset-anggi-cover',
      invitationId: 'inv-anggi',
      kind: 'image',
      storagePath: path.join(uploadsDir, 'anggi-cover.png'),
      mimeType: 'image/png',
      originalFilename: 'anggi-cover.png',
      createdAt: now,
    },
  ]).run();

  const pagesDir = path.join(tempDir, 'pages');
  process.env.INVITATION_PAGE_DIR = pagesDir;
  mkdirSync(path.join(pagesDir, 'templates', 'yt-wedding'), { recursive: true });
  mkdirSync(path.join(pagesDir, 'production', 'anggi-ivan'), { recursive: true });

  writeFileSync(path.join(pagesDir, 'templates', 'yt-wedding', 'index.html'), templateHtmlWithPlaceholders);
  writeFileSync(path.join(pagesDir, 'production', 'anggi-ivan', 'index.html'), templateHtmlWithPlaceholders);

  app = new Hono();
  app.route('/i', invPage.invitationPageRouter);
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

describe('Task 3: yt-wedding published metadata and draft preview', () => {
  it('generates per-client metadata for published invitation without placeholder leakage', async () => {
    const res = await app.request('/i/riska-rafli');
    expect(res.status).toBe(200);
    const html = await res.text();

    const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
    expect(headMatch).not.toBeNull();
    const head = headMatch![0];

    // Correct per-client metadata
    expect(head).toContain('<title>Undangan Pernikahan Riska &amp; Rafli</title>');
    expect(head).toContain('content="Dengan penuh kebahagiaan, Riska &amp; Rafli mengundang Anda untuk hadir dan memberikan doa restu pada acara pernikahan kami."');
    expect(head).toContain('href="https://you-are-invited.my.id/i/riska-rafli"');
    expect(head).toContain('property="og:url" content="https://you-are-invited.my.id/i/riska-rafli"');
    expect(head).toContain('property="og:title" content="Undangan Pernikahan Riska &amp; Rafli"');
    expect(head).toContain('property="og:site_name" content="You Are Invited"');
    expect(head).toContain('property="og:locale" content="id_ID"');
    expect(head).toContain('name="twitter:title" content="Undangan Pernikahan Riska &amp; Rafli"');

    // Zero placeholder leakage in metadata: no Chara.id, no Juliet/Romeo, no old template title
    expect(head).not.toContain('Undangan Pernikahan (YouTube Theme)');
    expect(head).not.toMatch(/juliet/i);
    expect(head).not.toMatch(/romeo/i);
    expect(head).not.toMatch(/chara\.id/i);
    expect(head).not.toMatch(/httrack/i);
  });

  it('omits og:image and twitter:image when no approved image exists; does not borrow third-party/other client image', async () => {
    // inv-riska-published currently has no coverPhotoAssetId set
    const res = await app.request('/i/riska-rafli');
    expect(res.status).toBe(200);
    const html = await res.text();

    const head = html.match(/<head[\s\S]*?<\/head>/i)![0];
    expect(head).not.toContain('og:image');
    expect(head).not.toContain('twitter:image');
    expect(head).toContain('name="twitter:card" content="summary"');
    // Must not borrow template's chara.id placeholder image or Anggi's image
    expect(head).not.toContain('og-juliet-romeo.jpg');
    expect(head).not.toContain('asset-anggi-cover');
  });

  it('does NOT borrow another client asset even if coverPhotoAssetId is set to foreign asset', async () => {
    // Attempt to set Riska coverPhotoAssetId to Anggi's asset ID
    db.update(schema.invitations)
      .set({ coverPhotoAssetId: 'asset-anggi-cover' })
      .where(eq(schema.invitations.id, 'inv-riska-published'))
      .run();

    const res = await app.request('/i/riska-rafli');
    expect(res.status).toBe(200);
    const html = await res.text();

    const head = html.match(/<head[\s\S]*?<\/head>/i)![0];
    // Omit og:image because asset-anggi-cover belongs to inv-anggi, not inv-riska-published
    expect(head).not.toContain('og:image');
    expect(head).not.toContain('twitter:image');
    expect(head).not.toContain('asset-anggi-cover');
  });

  it('renders verified invitation-owned approved image when valid', async () => {
    // Set Riska coverPhotoAssetId to its own asset
    db.update(schema.invitations)
      .set({ coverPhotoAssetId: 'asset-riska-cover' })
      .where(eq(schema.invitations.id, 'inv-riska-published'))
      .run();

    const res = await app.request('/i/riska-rafli');
    expect(res.status).toBe(200);
    const html = await res.text();

    const head = html.match(/<head[\s\S]*?<\/head>/i)![0];
    expect(head).toContain('property="og:image" content="https://you-are-invited.my.id/api/assets/asset-riska-cover"');
    expect(head).toContain('name="twitter:image" content="https://you-are-invited.my.id/api/assets/asset-riska-cover"');
    expect(head).toContain('name="twitter:card" content="summary_large_image"');
  });

  it('keeps Anggi initial social metadata and cover distinct from Riska', async () => {
    db.update(schema.invitations).set({ coverPhotoAssetId: 'asset-anggi-cover' }).where(eq(schema.invitations.id, 'inv-anggi')).run();
    const res = await app.request('/i/anggi-ivan?to=%3Cscript%3E');
    expect(res.status).toBe(200);
    const head = (await res.text()).match(/<head[\s\S]*?<\/head>/i)![0];
    expect(head).toContain('<title>Undangan Pernikahan Anggi &amp; Ivan</title>');
    expect(head).toContain('property="og:image" content="https://you-are-invited.my.id/api/assets/asset-anggi-cover"');
    expect(head).not.toContain('asset-riska-cover');
    expect(head).not.toContain('<script>');
  });

  it('serves actual converted yt-wedding bundle with client metadata and safe initial body', async () => {
    const pageDir = process.env.INVITATION_PAGE_DIR;
    const cwd = process.cwd();
    try {
      process.chdir(path.resolve(__dirname, '../../../..'));
      delete process.env.INVITATION_PAGE_DIR;
      db.update(schema.invitations).set({ coupleDisplayName: 'Riska & Rafli', title: 'Pernikahan Riska & Rafli' }).where(eq(schema.invitations.id, 'inv-riska-published')).run();
      const res = await app.request('/i/riska-rafli?to=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('<title>Undangan Pernikahan Riska &amp; Rafli</title>');
      expect(html).toContain('og:image" content="https://you-are-invited.my.id/api/assets/asset-riska-cover');
      expect(html).toContain('id="welcome-cover"');
      expect(html).toContain('id="form-rsvp"');
      expect(html).toContain('id="gallery-grid"');
      expect(html).toContain('assets/js/bind.js');
      expect(html).not.toMatch(/chara\.id|Juliet|Romeo|api\.qrserver\.com|static\.cloudflareinsights\.com/i);
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      // Actual body retains draft markers until client-side bind.js fetches published payload.
      expect(html).toContain('[Belum diisi]');
    } finally {
      process.chdir(cwd);
      if (pageDir === undefined) delete process.env.INVITATION_PAGE_DIR;
      else process.env.INVITATION_PAGE_DIR = pageDir;
    }
  });

  it('keeps guest query out of initial HTML and preserves client body after publication', async () => {
    db.update(schema.invitations).set({ coupleDisplayName: 'Riska & Rafli', title: 'Pernikahan Riska & Rafli' }).where(eq(schema.invitations.id, 'inv-riska-published')).run();
    const res = await app.request('/i/riska-rafli?to=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    const converted = readFileSync(path.resolve(__dirname, '../../private-pages/yt-wedding/index.html'), 'utf8');
    expect(converted).toContain('id="welcome-cover"');
    expect(converted).toContain('id="form-rsvp"');
    expect(converted).toContain('assets/js/bind.js');
    expect(html).toContain('Template Body');
    expect(html).toContain('Undangan Pernikahan Riska &amp; Rafli');
    // Fixture intentionally contains source placeholders; production bundle is checked separately.
  });

  it('escapes special characters in title, metadata, and canonical attributes', async () => {
    db.update(schema.invitations)
      .set({
        coupleDisplayName: 'Riska & "Rafli" <script>',
        title: 'Pernikahan Riska & "Rafli" <script>',
      })
      .where(eq(schema.invitations.id, 'inv-riska-published'))
      .run();

    const res = await app.request('/i/riska-rafli');
    const html = await res.text();
    const head = html.match(/<head[\s\S]*?<\/head>/i)![0];

    expect(head).toContain('<title>Undangan Pernikahan Riska &amp; &quot;Rafli&quot; &lt;script&gt;</title>');
    expect(head).toContain('content="Undangan Pernikahan Riska &amp; &quot;Rafli&quot; &lt;script&gt;"');
    expect(head).not.toContain('<script>');
  });

  it('renders clean draft preview metadata with noindex, nofollow and NO crawlable canonical or OG tags', async () => {
    const draftInv = db.select().from(schema.invitations).where(eq(schema.invitations.id, 'inv-riska-draft')).get()!;
    const rendered = renderInvitationHtml(draftInv, { isPreview: true });

    expect(rendered.status).toBe(200);
    expect(rendered.headers['Cache-Control']).toBe('private, no-store');
    expect(rendered.headers['X-Robots-Tag']).toBe('noindex, nofollow');

    const html = rendered.html!;
    const head = html.match(/<head[\s\S]*?<\/head>/i)![0];

    // Clean title and description present
    expect(head).toContain('<title>Undangan Pernikahan Riska &amp; Rafli</title>');
    expect(head).toContain('<meta name="description"');
    expect(head).toContain('<meta name="robots" content="noindex, nofollow">');

    // NO crawlable canonical link
    expect(head).not.toContain('rel="canonical"');
    expect(head).not.toContain('<link rel="canonical"');

    // NO crawlable OG url or social crawler tags in draft preview
    expect(head).not.toContain('property="og:url"');
    expect(head).not.toContain('property="og:');
    expect(head).not.toContain('name="twitter:');

    // Zero placeholder leakage in draft preview metadata
    expect(head).not.toMatch(/juliet/i);
    expect(head).not.toMatch(/romeo/i);
    expect(head).not.toMatch(/chara\.id/i);
  });
});
