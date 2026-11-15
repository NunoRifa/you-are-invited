import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { eq } from 'drizzle-orm';
import type { PublicInvitationPayload, YTWeddingSettingsInput } from '@you-are-invited/shared-types';

const tempDir = mkdtempSync(path.join(tmpdir(), 'yai-yt-wedding-settings-'));
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

function uploadFile(user: string, invitationId: string, filename: string, type: string, bytes: Uint8Array, kind = 'image') {
  const body = new FormData();
  body.append('file', new File([bytes], filename, { type }));
  body.append('kind', kind);
  return app.request(`/api/admin/invitations/${invitationId}/assets`, {
    method: 'POST',
    headers: cookie(user),
    body,
  });
}

function makeValidMp4(size = 32): Buffer {
  const buf = Buffer.alloc(size);
  buf.writeUInt32BE(size, 0);
  buf.write('ftyp', 4, 'ascii');
  buf.write('mp42', 8, 'ascii');
  return buf;
}

function makeValidPng(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
}

function makeValidJpeg(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
}

function makeValidWebp(): Buffer {
  return Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0x20, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP', 'ascii'),
    Buffer.from('VP8 ', 'ascii'),
  ]);
}

beforeAll(async () => {
  schema = await import('../../db/schema.js');
  ({ db, sqlite } = await import('../../db/client.js'));
  const { adminInvitationsRouter } = await import('./invitations.js');
  const { invitationsRouter } = await import('../invitations.js');
  const { assetsRouter } = await import('../assets.js');

  const now = Date.now();
  db.insert(schema.templates).values([
    { id: 'raden-motion', displayName: 'Raden Motion' },
    { id: 'yt-wedding', displayName: 'YouTube Wedding' },
  ]).run();

  db.insert(schema.adminUsers).values([
    { id: 'admin-root', email: 'root@example.test', passwordHash: 'unused', role: 'super_admin', createdAt: now },
    { id: 'user-yt', email: 'yt@example.test', passwordHash: 'unused', role: 'owner', createdAt: now },
    { id: 'user-other', email: 'other@example.test', passwordHash: 'unused', role: 'owner', createdAt: now },
  ]).run();

  db.insert(schema.sessions).values([
    { id: 'session-root', userId: 'admin-root', expiresAt: now + 600_000 },
    { id: 'session-yt', userId: 'user-yt', expiresAt: now + 600_000 },
    { id: 'session-other', userId: 'user-other', expiresAt: now + 600_000 },
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
      updatedAt: now,
    },
    {
      id: 'inv-anggi',
      slug: 'anggi-ivan',
      ownerUserId: null,
      title: 'Anggi & Ivan',
      templateKey: 'raden-motion',
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'inv-other',
      slug: 'other-wedding',
      ownerUserId: 'user-other',
      title: 'Other Wedding',
      templateKey: 'yt-wedding',
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    },
  ]).run();

  app = new Hono();
  app.use('/api/admin/invitations/:id/assets', bodyLimit({
    maxSize: 21 * 1024 * 1024,
    onError: (c) => c.json({ error: 'Upload request exceeds the 21 MiB limit' }, 413),
  }));
  app.route('/api/admin/invitations', adminInvitationsRouter);
  app.route('/api/invitations', invitationsRouter);
  app.route('/api/assets', assetsRouter);
});

afterAll(() => {
  sqlite?.close();
  process.chdir(previousCwd);
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('Task 5: Media trust boundary and typed yt-wedding template settings', () => {
  it('accepts valid media uploads (PNG, JPEG, WebP, MP4) with 201', async () => {
    const pngRes = await uploadFile('yt', 'inv-yt', 'photo.png', 'image/png', makeValidPng(), 'image');
    expect(pngRes.status).toBe(201);
    const pngData = await pngRes.json() as { id: string };
    expect(pngData.id).toMatch(/^ast-/);

    const jpgRes = await uploadFile('yt', 'inv-yt', 'photo.jpg', 'image/jpeg', makeValidJpeg(), 'image');
    expect(jpgRes.status).toBe(201);

    const webpRes = await uploadFile('yt', 'inv-yt', 'photo.webp', 'image/webp', makeValidWebp(), 'image');
    expect(webpRes.status).toBe(201);

    const mp4Res = await uploadFile('yt', 'inv-yt', 'video.mp4', 'video/mp4', makeValidMp4(), 'video');
    expect(mp4Res.status).toBe(201);
    const mp4Data = await mp4Res.json() as { id: string };
    expect(mp4Data.id).toMatch(/^ast-/);

    const assetRow = db.select().from(schema.invitationAssets).where(eq(schema.invitationAssets.id, mp4Data.id)).get();
    expect(assetRow).toBeDefined();
    expect(assetRow?.kind).toBe('video');
    expect(assetRow?.mimeType).toBe('video/mp4');
  });

  it('rejects fake images and fake videos with 415 (invalid signature)', async () => {
    // Fake PNG (HTML disguised as PNG)
    const fakePng = await uploadFile('yt', 'inv-yt', 'evil.png', 'image/png', Buffer.from('<script>alert("png")</script>'), 'image');
    expect(fakePng.status).toBe(415);

    // Fake JPEG (plain text disguised as JPEG)
    const fakeJpg = await uploadFile('yt', 'inv-yt', 'evil.jpg', 'image/jpeg', Buffer.from('not a jpeg file content'), 'image');
    expect(fakeJpg.status).toBe(415);

    // Fake WebP (plain text disguised as WebP)
    const fakeWebp = await uploadFile('yt', 'inv-yt', 'evil.webp', 'image/webp', Buffer.from('RIFF1234NOTWEBP'), 'image');
    expect(fakeWebp.status).toBe(415);

    // Fake MP4 (text disguised as MP4)
    const fakeMp4 = await uploadFile('yt', 'inv-yt', 'fake.mp4', 'video/mp4', Buffer.from('not an mp4 ftyp container'), 'video');
    expect(fakeMp4.status).toBe(415);

    // Video with invalid extension
    const badExtVideo = await uploadFile('yt', 'inv-yt', 'video.mkv', 'video/mp4', makeValidMp4(), 'video');
    expect(badExtVideo.status).toBe(415);
  });

  it('rejects oversize video (>20 MiB) with 413', async () => {
    const oversizeBytes = Buffer.alloc(20 * 1024 * 1024 + 1);
    oversizeBytes.writeUInt32BE(32, 0);
    oversizeBytes.write('ftyp', 4, 'ascii');
    oversizeBytes.write('mp42', 8, 'ascii');

    const res = await uploadFile('yt', 'inv-yt', 'huge.mp4', 'video/mp4', oversizeBytes, 'video');
    expect(res.status).toBe(413);
  });

  it('failed upload leaves existing files and database references completely intact', async () => {
    const initialAssets = db.select().from(schema.invitationAssets).where(eq(schema.invitationAssets.invitationId, 'inv-yt')).all();

    // Attempt bad upload
    const badRes = await uploadFile('yt', 'inv-yt', 'disguised.png', 'image/png', Buffer.from('corrupt'), 'image');
    expect(badRes.status).toBe(415);

    const postAssets = db.select().from(schema.invitationAssets).where(eq(schema.invitationAssets.invitationId, 'inv-yt')).all();
    expect(postAssets.length).toBe(initialAssets.length);
  });

  it('serves uploaded draft video with video/mp4 MIME and enforces draft access control', async () => {
    const videoUpload = await uploadFile('yt', 'inv-yt', 'hero.mp4', 'video/mp4', makeValidMp4(), 'video');
    expect(videoUpload.status).toBe(201);
    const { id: videoAssetId } = await videoUpload.json() as { id: string };

    // Unauthenticated access to draft asset should return 404
    const unauthRes = await app.request(`/api/assets/${videoAssetId}`);
    expect(unauthRes.status).toBe(404);

    // Cross-user (other invitation owner) access to draft asset should return 404
    const crossRes = await app.request(`/api/assets/${videoAssetId}`, { headers: cookie('other') });
    expect(crossRes.status).toBe(404);

    // Authorized owner access should return 200 with video/mp4
    const authRes = await app.request(`/api/assets/${videoAssetId}`, { headers: cookie('yt') });
    expect(authRes.status).toBe(200);
    expect(authRes.headers.get('Content-Type')).toBe('video/mp4');

    // Super admin access should also return 200 with video/mp4
    const rootRes = await app.request(`/api/assets/${videoAssetId}`, { headers: cookie('root') });
    expect(rootRes.status).toBe(200);
    expect(rootRes.headers.get('Content-Type')).toBe('video/mp4');
  });

  it('PATCH /api/admin/invitations/:id/yt-wedding saves typed settings and reflects in read-back', async () => {
    const videoUpload = await uploadFile('yt', 'inv-yt', 'wedding-hero.mp4', 'video/mp4', makeValidMp4(), 'video');
    const { id: heroVideoAssetId } = await videoUpload.json() as { id: string };

    const settings: YTWeddingSettingsInput = {
      heroCaption: 'Riska & Rafli Wedding Premiere',
      communityIntro: 'Selamat datang di channel pernikahan kami',
      eventIntro: 'Rangkaian acara pernikahan',
      galleryIntro: 'Momen bahagia kami',
      giftIntro: 'Tanda kasih untuk kedua mempelai',
      musicLabel: 'Official Audio Track',
      shippingAddress: 'Jl. Merdeka No. 45, Jakarta Selatan',
      heroVideoAssetId,
      showGallery: true,
      showGift: false,
    };

    const patchRes = await app.request('/api/admin/invitations/inv-yt/yt-wedding', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify(settings),
    });
    expect(patchRes.status).toBe(200);

    // Read back via admin GET /:id
    const adminRes = await app.request('/api/admin/invitations/inv-yt', { headers: cookie('yt') });
    expect(adminRes.status).toBe(200);
    const adminData = await adminRes.json() as {
      invitation: { heroVideoAssetId?: string | null; heroVideoUrl?: string | null };
      templateFields: Array<{ fieldKey: string; fieldValue: string }>;
    };

    expect(adminData.invitation.heroVideoAssetId).toBe(heroVideoAssetId);
    expect(adminData.invitation.heroVideoUrl).toBe(`/api/assets/${heroVideoAssetId}`);

    const fieldMap = Object.fromEntries(adminData.templateFields.map((f) => [f.fieldKey, f.fieldValue]));
    expect(fieldMap['yt_hero_caption']).toBe('Riska & Rafli Wedding Premiere');
    expect(fieldMap['yt_community_intro']).toBe('Selamat datang di channel pernikahan kami');
    expect(fieldMap['yt_event_intro']).toBe('Rangkaian acara pernikahan');
    expect(fieldMap['yt_gallery_intro']).toBe('Momen bahagia kami');
    expect(fieldMap['yt_gift_intro']).toBe('Tanda kasih untuk kedua mempelai');
    expect(fieldMap['yt_music_label']).toBe('Official Audio Track');
    expect(fieldMap['yt_shipping_address']).toBe('Jl. Merdeka No. 45, Jakarta Selatan');
    expect(fieldMap['yt_hero_video_asset_id']).toBe(heroVideoAssetId);
    expect(fieldMap['yt_show_gallery']).toBe('true');
    expect(fieldMap['yt_show_gift']).toBe('false');

    // Read back via admin preview data
    const previewRes = await app.request('/api/admin/invitations/inv-yt/preview/data', { headers: cookie('yt') });
    expect(previewRes.status).toBe(200);
    const previewPayload = await previewRes.json() as PublicInvitationPayload;
    expect(previewPayload.templateFields['yt_hero_caption']).toBe('Riska & Rafli Wedding Premiere');
    expect(previewPayload.templateFields['yt_show_gallery']).toBe('true');
    expect(previewPayload.templateFields['yt_show_gift']).toBe('false');
    expect(previewPayload.invitation.heroVideoAssetId).toBe(heroVideoAssetId);
    expect(previewPayload.invitation.heroVideoUrl).toBe(`/api/assets/${heroVideoAssetId}`);

    // Update with null fields to verify deletion/clearing
    const clearRes = await app.request('/api/admin/invitations/inv-yt/yt-wedding', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({ heroCaption: null, heroVideoAssetId: null }),
    });
    expect(clearRes.status).toBe(200);

    const postClearAdmin = await (await app.request('/api/admin/invitations/inv-yt', { headers: cookie('yt') })).json() as {
      invitation: { heroVideoAssetId?: string | null };
      templateFields: Array<{ fieldKey: string; fieldValue: string }>;
    };
    expect(postClearAdmin.invitation.heroVideoAssetId).toBeNull();
    const postClearMap = Object.fromEntries(postClearAdmin.templateFields.map((f) => [f.fieldKey, f.fieldValue]));
    expect(postClearMap['yt_hero_caption']).toBeUndefined();
    // Community intro should still be intact
    expect(postClearMap['yt_community_intro']).toBe('Selamat datang di channel pernikahan kami');
  });

  it('rejects /yt-wedding PATCH for non-yt-wedding invitations with 400', async () => {
    const res = await app.request('/api/admin/invitations/inv-anggi/yt-wedding', {
      method: 'PATCH',
      headers: jsonHeaders('root'),
      body: JSON.stringify({ heroCaption: 'Not Allowed' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated (401) and unauthorized (404) actors from /yt-wedding', async () => {
    // Unauthenticated
    const unauth = await app.request('/api/admin/invitations/inv-yt/yt-wedding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heroCaption: 'No Auth' }),
    });
    expect(unauth.status).toBe(401);

    // Unauthorized (user-other trying to access inv-yt)
    const unauthorized = await app.request('/api/admin/invitations/inv-yt/yt-wedding', {
      method: 'PATCH',
      headers: jsonHeaders('other'),
      body: JSON.stringify({ heroCaption: 'Wrong Owner' }),
    });
    expect(unauthorized.status).toBe(404);
  });

  it('rejects foreign heroVideoAssetId and non-video asset with 400', async () => {
    // Foreign video (owned by other invitation)
    const otherVideo = await uploadFile('other', 'inv-other', 'other.mp4', 'video/mp4', makeValidMp4(), 'video');
    const { id: foreignAssetId } = await otherVideo.json() as { id: string };

    const foreignRes = await app.request('/api/admin/invitations/inv-yt/yt-wedding', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({ heroVideoAssetId: foreignAssetId }),
    });
    expect(foreignRes.status).toBe(400);

    // Image asset (wrong kind)
    const imgUpload = await uploadFile('yt', 'inv-yt', 'pic.png', 'image/png', makeValidPng(), 'image');
    const { id: imgAssetId } = await imgUpload.json() as { id: string };

    const wrongKindRes = await app.request('/api/admin/invitations/inv-yt/yt-wedding', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({ heroVideoAssetId: imgAssetId }),
    });
    expect(wrongKindRes.status).toBe(400);

    // Non-existent asset ID
    const nonExistentRes = await app.request('/api/admin/invitations/inv-yt/yt-wedding', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({ heroVideoAssetId: 'ast-does-not-exist' }),
    });
    expect(nonExistentRes.status).toBe(400);
  });

  it('rejects string > 2000 chars, script tags, unsupported keys, and invalid booleans with 400', async () => {
    // String > 2000 chars
    const tooLong = await app.request('/api/admin/invitations/inv-yt/yt-wedding', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({ heroCaption: 'A'.repeat(2001) }),
    });
    expect(tooLong.status).toBe(400);

    // Raw script tag
    const scriptTag = await app.request('/api/admin/invitations/inv-yt/yt-wedding', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({ heroCaption: 'Hello <script>alert(1)</script>' }),
    });
    expect(scriptTag.status).toBe(400);

    // Unsupported key
    const unsupportedKey = await app.request('/api/admin/invitations/inv-yt/yt-wedding', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({ randomKey: 'not allowed' }),
    });
    expect(unsupportedKey.status).toBe(400);

    // Non-boolean showGallery
    const invalidBool = await app.request('/api/admin/invitations/inv-yt/yt-wedding', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({ showGallery: 'yes' }),
    });
    expect(invalidBool.status).toBe(400);
  });

  it('validates PATCH /:id/livestream URL scheme and length limits', async () => {
    // Valid HTTPS URL
    const validHttps = await app.request('/api/admin/invitations/inv-yt/livestream', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({ streamUrl: 'https://youtube.com/live/wedding123', label: 'Live Akad' }),
    });
    expect(validHttps.status).toBe(200);

    // Invalid scheme (javascript:)
    const badScheme = await app.request('/api/admin/invitations/inv-yt/livestream', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({ streamUrl: 'javascript:alert(1)' }),
    });
    expect(badScheme.status).toBe(400);

    // Invalid URL string
    const invalidUrl = await app.request('/api/admin/invitations/inv-yt/livestream', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({ streamUrl: 'not a url at all' }),
    });
    expect(invalidUrl.status).toBe(400);

    // Oversize stream URL (>2000 chars)
    const oversizeUrl = await app.request('/api/admin/invitations/inv-yt/livestream', {
      method: 'PATCH',
      headers: jsonHeaders('yt'),
      body: JSON.stringify({ streamUrl: `https://example.com/${'x'.repeat(2001)}` }),
    });
    expect(oversizeUrl.status).toBe(400);
  });

  it('leaves Anggi invitation settings and public route unchanged', async () => {
    const anggiPublic = await app.request('/api/invitations/anggi-ivan');
    expect(anggiPublic.status).toBe(200);
    const payload = await anggiPublic.json() as PublicInvitationPayload;
    expect(payload.invitation.templateKey).toBe('raden-motion');
    expect(payload.invitation.slug).toBe('anggi-ivan');
  });
});
