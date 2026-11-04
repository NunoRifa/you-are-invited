import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { Hono } from 'hono';
import { db, sqlite } from '../../db/client.js';
import * as schema from '../../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { defaultLoveStoryItems, LOVE_STORY_FIELD_KEY, parseLoveStoryFieldValue, parseLoveStoryItems } from '../../lib/love-story.js';
import { authorizedInvitation, canManageInvitation, getAdminActor } from './authorization.js';
import { buildPublicInvitationPayload } from '../invitations.js';
import { renderInvitationHtml, resolveSafeTemplateAsset } from '../invitation-page.js';

const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

const AUDIO_MIME_TYPES: Record<string, string[]> = {
  '.mp3': ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'audio/x-mp3'],
  '.m4a': ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
  '.wav': ['audio/wav', 'audio/x-wav', 'audio/wave'],
  '.ogg': ['audio/ogg', 'application/ogg'],
};

const IMAGE_MIME_TYPES: Record<string, string[]> = {
  '.png': ['image/png'],
  '.jpg': ['image/jpeg', 'image/pjpeg'],
  '.jpeg': ['image/jpeg', 'image/pjpeg'],
  '.webp': ['image/webp'],
};

const VIDEO_MIME_TYPES: Record<string, string[]> = {
  '.mp4': ['video/mp4'],
};

function isValidMp3(bytes: Buffer): boolean {
  if (bytes.length < 4) return false;
  // ID3v2 header
  if (bytes.subarray(0, 3).toString() === 'ID3') return true;

  // Search through first 8 KiB for an MPEG sync word (0xFFE or 0xFFF)
  const maxSearch = Math.min(bytes.length - 1, 8192);
  for (let i = 0; i < maxSearch; i++) {
    if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) {
      // Validate valid MPEG layer (bits 1-2 cannot be 00)
      const layer = (bytes[i + 1] >> 1) & 0x03;
      if (layer !== 0) return true;
    }
  }

  // ID3v1 tag at EOF (last 128 bytes)
  if (bytes.length >= 128 && bytes.subarray(bytes.length - 128, bytes.length - 125).toString() === 'TAG') {
    return true;
  }

  return false;
}

function isValidPng(bytes: Buffer): boolean {
  if (bytes.length < 8) return false;
  return bytes[0] === 0x89 &&
         bytes[1] === 0x50 &&
         bytes[2] === 0x4e &&
         bytes[3] === 0x47 &&
         bytes[4] === 0x0d &&
         bytes[5] === 0x0a &&
         bytes[6] === 0x1a &&
         bytes[7] === 0x0a;
}

function isValidJpeg(bytes: Buffer): boolean {
  if (bytes.length < 3) return false;
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isValidWebp(bytes: Buffer): boolean {
  if (bytes.length < 12) return false;
  return bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
         bytes.subarray(8, 12).toString('latin1') === 'WEBP';
}

function isValidMp4(bytes: Buffer): boolean {
  return bytes.length >= 8 && bytes.subarray(4, 8).toString('latin1') === 'ftyp';
}

const AUDIO_SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  '.mp3': isValidMp3,
  '.m4a': (bytes) => bytes.length >= 8 && bytes.subarray(4, 8).toString() === 'ftyp',
  '.wav': (bytes) => bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE',
  '.ogg': (bytes) => bytes.length >= 4 && bytes.subarray(0, 4).toString() === 'OggS',
};

const IMAGE_SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  '.png': isValidPng,
  '.jpg': isValidJpeg,
  '.jpeg': isValidJpeg,
  '.webp': isValidWebp,
};

const VIDEO_SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  '.mp4': isValidMp4,
};

function isPlaceholderUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl) return true;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === '#' || trimmed === 'https://#' || trimmed === 'http://#' || trimmed === 'https:///#') {
    return true;
  }
  if (trimmed.toLowerCase().includes('example.com') || trimmed.toLowerCase().includes('example.org')) {
    return true;
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;
    if (!u.hostname || u.hostname === '#' || u.hostname.includes('example.com') || u.hostname.includes('example.org')) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

const YT_ALLOWED_KEYS = new Set([
  'heroCaption',
  'communityIntro',
  'eventIntro',
  'galleryIntro',
  'giftIntro',
  'musicLabel',
  'shippingAddress',
  'heroVideoAssetId',
  'showGallery',
  'showGift',
]);

const YT_FIELD_MAP: Record<string, string> = {
  heroCaption: 'yt_hero_caption',
  communityIntro: 'yt_community_intro',
  eventIntro: 'yt_event_intro',
  galleryIntro: 'yt_gallery_intro',
  giftIntro: 'yt_gift_intro',
  musicLabel: 'yt_music_label',
  shippingAddress: 'yt_shipping_address',
  heroVideoAssetId: 'yt_hero_video_asset_id',
  showGallery: 'yt_show_gallery',
  showGift: 'yt_show_gift',
};

export const adminInvitationsRouter = new Hono();

adminInvitationsRouter.use('*', async (c, next) => {
  const actor = getAdminActor(c.req.header('Cookie'));
  if (!actor) return c.json({ error: 'Unauthenticated' }, 401);
  const id = c.req.path.match(/^\/api\/admin\/invitations\/([^/]+)/)?.[1];
  if (id && !authorizedInvitation(c.req.header('Cookie'), decodeURIComponent(id)).invitation) {
    return c.json({ error: 'Invitation not found' }, 404);
  }
  await next();
});

// GET /api/admin/invitations
adminInvitationsRouter.get('/', (c) => {
  const actor = getAdminActor(c.req.header('Cookie'))!;
  const list = db
    .select()
    .from(schema.invitations)
    .orderBy(desc(schema.invitations.createdAt))
    .all();

  return c.json(list.filter((invitation) => canManageInvitation(actor, invitation)));
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
  const assets = db.select().from(schema.invitationAssets).where(eq(schema.invitationAssets.invitationId, id)).all();
  const gallery = db.select().from(schema.galleryImages).where(eq(schema.galleryImages.invitationId, id)).orderBy(schema.galleryImages.sortOrder).all();

  const heroField = fields.find((f) => f.fieldKey === 'hero_photo_asset_id');
  const closingField = fields.find((f) => f.fieldKey === 'closing_photo_asset_id');
  const galleryVideoField = fields.find((f) => f.fieldKey === 'gallery_video_url');
  const ytHeroVideoField = fields.find((f) => f.fieldKey === 'yt_hero_video_asset_id');
  const loveStoryField = fields.find((f) => f.fieldKey === LOVE_STORY_FIELD_KEY);
  const musicAsset = assets.find((a) => a.kind === 'audio');
  const storedLoveStory = parseLoveStoryFieldValue(loveStoryField?.fieldValue);
  const loveStory = (storedLoveStory || (inv.slug === 'anggi-ivan' ? defaultLoveStoryItems() : []))
    .map((item) => {
      const photo = item.photoAssetId
        ? assets.find((asset) => asset.id === item.photoAssetId && asset.kind === 'image')
        : undefined;
      return {
        ...item,
        photoAssetId: photo?.id || null,
        photoUrl: photo ? `/api/assets/${photo.id}` : null,
      };
    });

  return c.json({
    invitation: {
      ...inv,
      coverPhotoUrl: inv.coverPhotoAssetId ? `/api/assets/${inv.coverPhotoAssetId}` : null,
      heroPhotoAssetId: heroField?.fieldValue || null,
      heroPhotoUrl: heroField?.fieldValue ? `/api/assets/${heroField.fieldValue}` : null,
      closingPhotoAssetId: closingField?.fieldValue || null,
      closingPhotoUrl: closingField?.fieldValue ? `/api/assets/${closingField.fieldValue}` : null,
      galleryVideoUrl: galleryVideoField?.fieldValue || null,
      heroVideoAssetId: ytHeroVideoField?.fieldValue || null,
      heroVideoUrl: ytHeroVideoField?.fieldValue ? `/api/assets/${ytHeroVideoField.fieldValue}` : null,
      musicUrl: musicAsset ? `/api/assets/${musicAsset.id}` : null,
      musicAsset: musicAsset ? {
        id: musicAsset.id,
        originalFilename: musicAsset.originalFilename,
        url: `/api/assets/${musicAsset.id}`,
      } : null,
    },
    couples: couples.map((cp) => ({
      ...cp,
      photoUrl: cp.photoAssetId ? `/api/assets/${cp.photoAssetId}` : null,
    })),
    events,
    giftAccounts,
    wishes,
    templateFields: fields,
    livestream: livestream || null,
    assets: assets.map((a) => ({
      ...a,
      url: `/api/assets/${a.id}`,
    })),
    gallery: gallery.map((g) => ({
      ...g,
      url: `/api/assets/${g.assetId}`,
    })),
    loveStory,
  });
});

// GET /api/admin/invitations/:id/preview and /preview/
const handleAdminPreview = (c: any) => {
  const id = c.req.param('id');
  const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, id)).get();
  if (!inv) return c.notFound();
  const res = renderInvitationHtml(inv, { isPreview: true });
  if (res.status !== 200) return c.text(res.error || 'Invitation template not available', res.status);
  return c.html(res.html!, 200, res.headers);
};
adminInvitationsRouter.get('/:id/preview', handleAdminPreview);
adminInvitationsRouter.get('/:id/preview/', handleAdminPreview);

// GET /api/admin/invitations/:id/preview/data
adminInvitationsRouter.get('/:id/preview/data', (c) => {
  const id = c.req.param('id');
  const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, id)).get();
  if (!inv) return c.notFound();
  const payload = buildPublicInvitationPayload(inv);
  return c.json(payload, 200, {
    'Cache-Control': 'private, no-store',
  });
});

// GET /api/admin/invitations/:id/preview/assets/:file{.*} and fallback /:id/assets/:file{.*}
const handleAdminPreviewAsset = (c: any) => {
  const id = c.req.param('id');
  const file = c.req.param('file');
  const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, id)).get();
  if (!inv) return c.notFound();
  const asset = resolveSafeTemplateAsset(inv, file);
  if (!asset) return c.notFound();
  const fileBuffer = fs.readFileSync(asset.filePath);
  return new Response(fileBuffer, {
    headers: {
      'Content-Type': asset.mimeType,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};
adminInvitationsRouter.get('/:id/preview/assets/:file{.*}', handleAdminPreviewAsset);
adminInvitationsRouter.get('/:id/assets/:file{.*}', handleAdminPreviewAsset);

// POST /api/admin/invitations/:id/assets - Multipart file upload
adminInvitationsRouter.post('/:id/assets', async (c) => {
  const invitationId = c.req.param('id');
  const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, invitationId)).get();
  if (!inv) return c.json({ error: 'Invitation not found' }, 404);

  const body = await c.req.parseBody();
  const file = body['file'];
  const kind = (body['kind'] as 'image' | 'audio' | 'font' | 'video') || 'image';

  if (!['image', 'audio', 'font', 'video'].includes(kind)) return c.json({ error: 'Unsupported asset kind' }, 400);
  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file uploaded' }, 400);
  }

  const originalFilename = file.name || (kind === 'audio' ? 'music.mp3' : (kind === 'video' ? 'video.mp4' : 'image.jpg'));
  const ext = (path.extname(originalFilename) || (kind === 'audio' ? '.mp3' : (kind === 'video' ? '.mp4' : '.jpg'))).toLowerCase();
  const mimeType = (file.type || '').toLowerCase();

  if (kind === 'audio') {
    if (file.size > MAX_AUDIO_BYTES) {
      return c.json({ error: 'Audio file exceeds the 20 MiB limit', code: 'audio_size_exceeded' }, 413);
    }
    const allowedMimes = AUDIO_MIME_TYPES[ext];
    const isValidMime = allowedMimes?.includes(mimeType) || (mimeType === 'application/octet-stream' && allowedMimes !== undefined);
    if (!isValidMime) {
      return c.json({ error: 'Unsupported audio format. Use MP3, M4A, WAV, or OGG.', code: 'unsupported_audio_mime' }, 415);
    }
  }

  if (kind === 'video') {
    if (file.size > MAX_MEDIA_BYTES) {
      return c.json({ error: 'Video file exceeds the 20 MiB limit', code: 'video_size_exceeded' }, 413);
    }
    const allowedMimes = VIDEO_MIME_TYPES[ext];
    const isValidMime = allowedMimes?.includes(mimeType) || (mimeType === 'application/octet-stream' && allowedMimes !== undefined);
    if (!isValidMime || ext !== '.mp4') {
      return c.json({ error: 'Unsupported video format. Use MP4.', code: 'unsupported_video_mime' }, 415);
    }
  }

  if (kind === 'image') {
    if (file.size > MAX_MEDIA_BYTES) {
      return c.json({ error: 'Image file exceeds the 20 MiB limit', code: 'image_size_exceeded' }, 413);
    }
    const allowedMimes = IMAGE_MIME_TYPES[ext];
    const isValidMime = allowedMimes?.includes(mimeType) || (mimeType === 'application/octet-stream' && allowedMimes !== undefined);
    if (!isValidMime) {
      return c.json({ error: 'Unsupported image format. Use PNG, JPEG, or WebP.', code: 'unsupported_image_mime' }, 415);
    }
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = Buffer.from(arrayBuffer);

  if (kind === 'audio') {
    if (fileBytes.byteLength > MAX_AUDIO_BYTES) {
      return c.json({ error: 'Audio file exceeds the 20 MiB limit', code: 'audio_size_exceeded' }, 413);
    }
    const verifySignature = AUDIO_SIGNATURES[ext];
    if (!verifySignature || !verifySignature(fileBytes)) {
      return c.json({ error: 'File content is not a supported audio format', code: 'invalid_audio_signature' }, 415);
    }
  }

  if (kind === 'video') {
    if (fileBytes.byteLength > MAX_MEDIA_BYTES) {
      return c.json({ error: 'Video file exceeds the 20 MiB limit', code: 'video_size_exceeded' }, 413);
    }
    const verifySignature = VIDEO_SIGNATURES[ext];
    if (!verifySignature || !verifySignature(fileBytes)) {
      return c.json({ error: 'File content is not a supported MP4 video', code: 'invalid_video_signature' }, 415);
    }
  }

  if (kind === 'image') {
    if (fileBytes.byteLength > MAX_MEDIA_BYTES) {
      return c.json({ error: 'Image file exceeds the 20 MiB limit', code: 'image_size_exceeded' }, 413);
    }
    const verifySignature = IMAGE_SIGNATURES[ext];
    if (!verifySignature || !verifySignature(fileBytes)) {
      return c.json({ error: 'File content is not a supported image format', code: 'invalid_image_signature' }, 415);
    }
  }

  const assetId = `ast-${randomUUID()}`;
  const safeFilename = `${assetId}${ext}`;
  const relativePath = `storage/uploads/${invitationId}/${safeFilename}`;
  const defaultMime = kind === 'audio'
    ? 'audio/mpeg'
    : (kind === 'video'
      ? 'video/mp4'
      : (kind === 'font'
        ? 'font/woff2'
        : (ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg')));
  const normalizedMime = (!mimeType || mimeType === 'application/octet-stream') ? defaultMime : mimeType;
  const uploadDir = path.resolve(process.cwd(), `storage/uploads/${invitationId}`);
  const targetPath = path.join(uploadDir, safeFilename);

  const existingAudios = kind === 'audio'
    ? db.select().from(schema.invitationAssets)
      .where(and(eq(schema.invitationAssets.invitationId, invitationId), eq(schema.invitationAssets.kind, 'audio')))
      .all()
    : [];

  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(targetPath, fileBytes, { flag: 'wx' });

    sqlite.transaction(() => {
      db.insert(schema.invitationAssets).values({
        id: assetId,
        invitationId,
        kind,
        storagePath: relativePath,
        mimeType: normalizedMime,
        originalFilename,
        createdAt: Date.now(),
      }).run();
      for (const oldAudio of existingAudios) {
        db.delete(schema.invitationAssets).where(eq(schema.invitationAssets.id, oldAudio.id)).run();
      }
    })();
  } catch (error) {
    try { fs.unlinkSync(targetPath); } catch {}
    console.error('[asset-upload] Failed to persist uploaded asset', error);
    return c.json({ error: 'Failed to save uploaded file. Existing assets were not changed.' }, 500);
  }

  // The transaction has committed; remove old files only now.
  for (const oldAudio of existingAudios) {
    const oldPath = path.resolve(process.cwd(), oldAudio.storagePath);
    try { fs.unlinkSync(oldPath); } catch {}
  }

  return c.json({
    id: assetId,
    url: `/api/assets/${assetId}`,
    kind,
    mimeType,
    originalFilename,
  }, 201);
});

// DELETE /api/admin/invitations/:id/music - Remove custom music and revert to template default
adminInvitationsRouter.delete('/:id/music', (c) => {
  const invitationId = c.req.param('id');
  const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, invitationId)).get();
  if (!inv) return c.json({ error: 'Invitation not found' }, 404);

  const existingAudios = db
    .select()
    .from(schema.invitationAssets)
    .where(and(eq(schema.invitationAssets.invitationId, invitationId), eq(schema.invitationAssets.kind, 'audio')))
    .all();

  for (const oldAudio of existingAudios) {
    const oldPath = path.resolve(process.cwd(), oldAudio.storagePath);
    if (fs.existsSync(oldPath)) {
      try { fs.unlinkSync(oldPath); } catch {}
    }
    db.delete(schema.invitationAssets).where(eq(schema.invitationAssets.id, oldAudio.id)).run();
  }

  return c.json({ success: true, message: 'Custom music removed, reverted to template default' });
});

// DELETE /api/admin/invitations/:id/assets/:assetId
adminInvitationsRouter.delete('/:id/assets/:assetId', (c) => {
  const invitationId = c.req.param('id');
  const assetId = c.req.param('assetId');

  const asset = db.select().from(schema.invitationAssets)
    .where(eq(schema.invitationAssets.id, assetId)).get();
  if (!asset || asset.invitationId !== invitationId) {
    return c.json({ error: 'Asset not found' }, 404);
  }

  // Clear references from cover photo and couples
  db.update(schema.invitations)
    .set({ coverPhotoAssetId: null })
    .where(and(eq(schema.invitations.id, invitationId), eq(schema.invitations.coverPhotoAssetId, assetId)))
    .run();

  db.update(schema.couples)
    .set({ photoAssetId: null })
    .where(and(eq(schema.couples.invitationId, invitationId), eq(schema.couples.photoAssetId, assetId)))
    .run();

  db.delete(schema.galleryImages)
    .where(and(eq(schema.galleryImages.invitationId, invitationId), eq(schema.galleryImages.assetId, assetId)))
    .run();

  db.delete(schema.invitationTemplateFields)
    .where(and(
      eq(schema.invitationTemplateFields.invitationId, invitationId),
      eq(schema.invitationTemplateFields.fieldValue, assetId)
    ))
    .run();

  db.delete(schema.invitationAssets).where(eq(schema.invitationAssets.id, assetId)).run();

  try {
    const fullPath = path.isAbsolute(asset.storagePath) ? asset.storagePath : path.resolve(process.cwd(), asset.storagePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch {}

  return c.json({ success: true });
});

// POST /api/admin/invitations/:id/gallery
adminInvitationsRouter.post('/:id/gallery', async (c) => {
  const invitationId = c.req.param('id');
  const body = await c.req.json<{ assetId?: string; caption?: string; sortOrder?: number }>();
  if (!body.assetId) return c.json({ error: 'assetId is required' }, 400);
  const asset = db.select().from(schema.invitationAssets).where(and(
    eq(schema.invitationAssets.id, body.assetId),
    eq(schema.invitationAssets.invitationId, invitationId),
    eq(schema.invitationAssets.kind, 'image'),
  )).get();
  if (!asset) return c.json({ error: 'Image asset not found for invitation' }, 400);

  const id = `gal-${randomUUID()}`;
  db.insert(schema.galleryImages).values({
    id,
    invitationId,
    assetId: body.assetId,
    caption: body.caption || '',
    sortOrder: body.sortOrder ?? 0,
  }).run();

  return c.json({
    id,
    assetId: body.assetId,
    caption: body.caption || '',
    sortOrder: body.sortOrder ?? 0,
    url: `/api/assets/${body.assetId}`,
  }, 201);
});

// DELETE /api/admin/invitations/:id/gallery/:galleryId
adminInvitationsRouter.delete('/:id/gallery/:galleryId', (c) => {
  const invitationId = c.req.param('id');
  const galleryId = c.req.param('galleryId');
  const item = db.select().from(schema.galleryImages).where(eq(schema.galleryImages.id, galleryId)).get();
  if (!item || item.invitationId !== invitationId) return c.json({ error: 'Gallery item not found' }, 404);

  db.delete(schema.galleryImages).where(eq(schema.galleryImages.id, galleryId)).run();
  return c.json({ success: true });
});

// Update a couple within an invitation.
adminInvitationsRouter.patch('/:id/couples/:coupleId', async (c) => {
  const invitationId = c.req.param('id');
  const coupleId = c.req.param('coupleId');
  const body = await c.req.json<Partial<Pick<typeof schema.couples.$inferInsert, 'fullName' | 'displayName' | 'fatherName' | 'motherName' | 'birthOrderLabel' | 'instagramHandle' | 'photoAssetId'>>>();
  const couple = db.select().from(schema.couples).where(eq(schema.couples.id, coupleId)).get();
  if (!couple || couple.invitationId !== invitationId) return c.json({ error: 'Couple not found' }, 404);
  if (body.photoAssetId) {
    const photo = db.select().from(schema.invitationAssets).where(and(
      eq(schema.invitationAssets.id, body.photoAssetId),
      eq(schema.invitationAssets.invitationId, invitationId),
      eq(schema.invitationAssets.kind, 'image'),
    )).get();
    if (!photo) return c.json({ error: 'Image asset not found for invitation' }, 400);
  }
  const update = Object.fromEntries(
    (['fullName', 'displayName', 'fatherName', 'motherName', 'birthOrderLabel', 'instagramHandle', 'photoAssetId'] as const)
      .filter((key) => Object.hasOwn(body, key)).map((key) => [key, body[key]]),
  );
  if (Object.keys(update).length) db.update(schema.couples).set(update).where(eq(schema.couples.id, coupleId)).run();
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
  const update = Object.fromEntries(
    (['label', 'date', 'startTime', 'endTimeLabel', 'venueName', 'venueAddress', 'mapsUrl', 'sortOrder'] as const)
      .filter((key) => Object.hasOwn(body, key)).map((key) => [key, body[key]]),
  );
  if (Object.keys(update).length) db.update(schema.events).set(update).where(eq(schema.events.id, eventId)).run();
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
  let body: { streamUrl?: string | null; date?: string | null; timeLabel?: string | null; label?: string | null };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, id)).get();
  if (!inv) {
    return c.json({ error: 'Invitation not found' }, 404);
  }

  if (body.streamUrl !== undefined && body.streamUrl !== null && body.streamUrl !== '') {
    if (typeof body.streamUrl !== 'string' || body.streamUrl.length > 2000) {
      return c.json({ error: 'Stream URL must not exceed 2000 characters' }, 400);
    }
    try {
      const parsed = new URL(body.streamUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return c.json({ error: 'Stream URL must use http or https scheme' }, 400);
      }
    } catch {
      return c.json({ error: 'Invalid stream URL format' }, 400);
    }
  }

  for (const [key, val] of Object.entries(body)) {
    if (typeof val === 'string' && val.length > 2000) {
      return c.json({ error: `${key} must not exceed 2000 characters` }, 400);
    }
  }

  const existing = db.select().from(schema.livestreamInfo).where(eq(schema.livestreamInfo.invitationId, id)).get();
  const update = Object.fromEntries(
    (['streamUrl', 'date', 'timeLabel', 'label'] as const)
      .filter((key) => Object.hasOwn(body, key)).map((key) => [key, body[key]]),
  );
  if (existing) {
    if (!Object.keys(update).length) return c.json({ success: true });
    db.update(schema.livestreamInfo)
      .set(update)
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

// PATCH /api/admin/invitations/:id/yt-wedding
adminInvitationsRouter.patch('/:id/yt-wedding', async (c) => {
  const id = c.req.param('id');
  const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, id)).get();
  if (!inv) return c.json({ error: 'Invitation not found' }, 404);

  if (inv.templateKey !== 'yt-wedding') {
    return c.json({ error: 'Endpoint only allowed for yt-wedding template' }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  for (const key of Object.keys(body)) {
    if (!YT_ALLOWED_KEYS.has(key)) {
      return c.json({ error: `Unsupported key: ${key}` }, 400);
    }
  }

  const stringKeys = [
    'heroCaption',
    'communityIntro',
    'eventIntro',
    'galleryIntro',
    'giftIntro',
    'musicLabel',
    'shippingAddress',
  ] as const;

  for (const key of stringKeys) {
    if (key in body && body[key] !== null && body[key] !== undefined) {
      const val = body[key];
      if (typeof val !== 'string') {
        return c.json({ error: `${key} must be a string or null` }, 400);
      }
      if (val.length > 2000) {
        return c.json({ error: `${key} exceeds maximum length of 2000 characters` }, 400);
      }
      if (/<script\b[^>]*>/i.test(val) || /<\/script>/i.test(val)) {
        return c.json({ error: `${key} contains forbidden script tag` }, 400);
      }
    }
  }

  if ('showGallery' in body && body.showGallery !== undefined && typeof body.showGallery !== 'boolean') {
    return c.json({ error: 'showGallery must be a boolean' }, 400);
  }
  if ('showGift' in body && body.showGift !== undefined && typeof body.showGift !== 'boolean') {
    return c.json({ error: 'showGift must be a boolean' }, 400);
  }

  if ('heroVideoAssetId' in body && body.heroVideoAssetId !== null && body.heroVideoAssetId !== undefined) {
    if (typeof body.heroVideoAssetId !== 'string') {
      return c.json({ error: 'heroVideoAssetId must be a string or null' }, 400);
    }
    const asset = db.select().from(schema.invitationAssets)
      .where(and(
        eq(schema.invitationAssets.id, body.heroVideoAssetId),
        eq(schema.invitationAssets.invitationId, id),
        eq(schema.invitationAssets.kind, 'video'),
      ))
      .get();
    if (!asset) {
      return c.json({ error: 'heroVideoAssetId must refer to an existing video asset belonging to this invitation' }, 400);
    }
  }

  const now = Date.now();
  sqlite.transaction(() => {
    for (const [key, rawVal] of Object.entries(body)) {
      const fieldKey = YT_FIELD_MAP[key];
      if (!fieldKey) continue;
      if (rawVal === null) {
        db.delete(schema.invitationTemplateFields)
          .where(and(
            eq(schema.invitationTemplateFields.invitationId, id),
            eq(schema.invitationTemplateFields.fieldKey, fieldKey),
          ))
          .run();
      } else if (rawVal !== undefined) {
        const strVal = String(rawVal);
        const existing = db.select().from(schema.invitationTemplateFields)
          .where(and(
            eq(schema.invitationTemplateFields.invitationId, id),
            eq(schema.invitationTemplateFields.fieldKey, fieldKey),
          ))
          .get();
        if (existing) {
          db.update(schema.invitationTemplateFields)
            .set({ fieldValue: strVal })
            .where(eq(schema.invitationTemplateFields.id, existing.id))
            .run();
        } else {
          db.insert(schema.invitationTemplateFields).values({
            id: `tf-yt-${randomUUID()}`,
            invitationId: id,
            fieldKey,
            fieldValue: strVal,
          }).run();
        }
      }
    }

    db.update(schema.invitations)
      .set({ updatedAt: now })
      .where(eq(schema.invitations.id, id))
      .run();

    const approval = db.select().from(schema.invitationTemplateFields)
      .where(and(
        eq(schema.invitationTemplateFields.invitationId, id),
        eq(schema.invitationTemplateFields.fieldKey, 'yt_publication_approval'),
      ))
      .get();
    if (approval) {
      try {
        const parsed = JSON.parse(approval.fieldValue);
        parsed.stale = true;
        parsed.staleAt = now;
        db.update(schema.invitationTemplateFields)
          .set({ fieldValue: JSON.stringify(parsed) })
          .where(eq(schema.invitationTemplateFields.id, approval.id))
          .run();
      } catch {}
    }
  })();

  return c.json({ success: true });
});

// PATCH /api/admin/invitations/:id/publication
adminInvitationsRouter.patch('/:id/publication', async (c) => {
  const id = c.req.param('id');
  const actor = getAdminActor(c.req.header('Cookie'))!;
  const body = await c.req.json<any>().catch(() => null);

  if (!body || typeof body.isPublished !== 'boolean') {
    return c.json({ error: 'Invalid publication payload: isPublished boolean required' }, 400);
  }

  const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, id)).get();
  if (!inv) return c.json({ error: 'Invitation not found' }, 404);

  if (body.isPublished) {
    if (typeof body.confirmation !== 'string') {
      return c.json({ error: 'confirmation required when publishing' }, 400);
    }

    if (inv.templateKey === 'yt-wedding' || inv.slug === 'riska-rafli') {
      if (actor.role !== 'super_admin') {
        return c.json({ error: 'Only super admin may publish yt-wedding invitations' }, 403);
      }
      if (body.confirmation !== inv.slug && body.confirmation !== 'PUBLISH') {
        return c.json({ error: 'Confirmation mismatch' }, 400);
      }

      const attestations = body.attestations;
      if (
        !attestations ||
        typeof attestations !== 'object' ||
        attestations.assetsLicensed !== true ||
        attestations.youtubeIdentityReviewed !== true ||
        attestations.visualParityChecked !== true ||
        attestations.linksVerified !== true
      ) {
        return c.json({ error: 'All 4 publication attestations must be confirmed' }, 422);
      }

      const reasons: string[] = [];

      const isOwnedImageAsset = (assetId: string | null | undefined): boolean => {
        if (!assetId) return false;
        const a = db.select().from(schema.invitationAssets)
          .where(and(
            eq(schema.invitationAssets.id, assetId),
            eq(schema.invitationAssets.invitationId, id),
            eq(schema.invitationAssets.kind, 'image')
          )).get();
        return Boolean(a);
      };

      const couplesList = db.select().from(schema.couples).where(eq(schema.couples.invitationId, id)).all();
      if (couplesList.length < 2) {
        reasons.push('Must have at least 2 couple profiles');
      } else {
        const invalidCouples = couplesList.filter((cp) => !cp.fullName?.trim() || !cp.displayName?.trim());
        if (invalidCouples.length > 0) {
          reasons.push('All couple profiles must have non-empty fullName and displayName');
        }
        for (const cp of couplesList) {
          if (!cp.photoAssetId || !isOwnedImageAsset(cp.photoAssetId)) {
            reasons.push(`Couple profile "${cp.displayName || cp.role}" must have an approved photo asset belonging to this invitation`);
          }
        }
      }

      if (!inv.quoteText?.trim() || !inv.quoteSource?.trim()) {
        reasons.push('Quote text and quote source must not be empty');
      }

      if (!inv.closingText?.trim()) {
        reasons.push('Closing text must not be empty');
      }

      const eventsList = db.select().from(schema.events).where(eq(schema.events.invitationId, id)).all();
      if (eventsList.length < 1) {
        reasons.push('Must have at least 1 event');
      } else {
        const invalidEvents = eventsList.filter((ev) =>
          !ev.date?.trim() || !ev.startTime?.trim() || !ev.venueName?.trim() || !ev.venueAddress?.trim()
        );
        if (invalidEvents.length > 0) {
          reasons.push('All events must have non-empty date, startTime, venueName, and venueAddress');
        }
        for (const ev of eventsList) {
          const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ev.date || '');
          let validDate = false;
          if (dateMatch) {
            const y = +dateMatch[1];
            const m = +dateMatch[2] - 1;
            const d = +dateMatch[3];
            const dt = new Date(Date.UTC(y, m, d));
            validDate = dt.getUTCFullYear() === y && dt.getUTCMonth() === m && dt.getUTCDate() === d;
          }
          if (!validDate) {
            reasons.push(`Event "${ev.label || 'Acara'}" must have a valid calendar date in YYYY-MM-DD format`);
          }

          const timeMatch = /^(\d{2}):(\d{2})$/.exec(ev.startTime || '');
          const validTime = Boolean(timeMatch && +timeMatch[1] >= 0 && +timeMatch[1] < 24 && +timeMatch[2] >= 0 && +timeMatch[2] < 60);
          if (!validTime) {
            reasons.push(`Event "${ev.label || 'Acara'}" must have a valid start time in HH:MM format (24-hour)`);
          }

          if (!ev.mapsUrl || isPlaceholderUrl(ev.mapsUrl)) {
            reasons.push(`Event "${ev.label || 'Acara'}" mapsUrl must not be empty or placeholder`);
          }
        }
      }

      const livestream = db.select().from(schema.livestreamInfo).where(eq(schema.livestreamInfo.invitationId, id)).get();
      if (livestream && (livestream.streamUrl?.trim() || livestream.date?.trim() || livestream.timeLabel?.trim() || livestream.label?.trim())) {
        if (!livestream.streamUrl || isPlaceholderUrl(livestream.streamUrl)) {
          reasons.push('Livestream streamUrl must be a valid http/https URL and not a placeholder');
        }
      }

      if (!inv.coverPhotoAssetId || !isOwnedImageAsset(inv.coverPhotoAssetId)) {
        reasons.push('Cover photo must be set and belong to this invitation as an approved image asset');
      }

      const showGalleryField = db.select().from(schema.invitationTemplateFields)
        .where(and(
          eq(schema.invitationTemplateFields.invitationId, id),
          eq(schema.invitationTemplateFields.fieldKey, 'yt_show_gallery')
        )).get();
      const galleryEnabled = !showGalleryField || showGalleryField.fieldValue !== 'false';
      if (galleryEnabled) {
        const galleryList = db.select().from(schema.galleryImages).where(eq(schema.galleryImages.invitationId, id)).all();
        if (galleryList.length === 0) {
          reasons.push('Gallery is enabled but has no images');
        } else {
          for (const g of galleryList) {
            if (!isOwnedImageAsset(g.assetId)) {
              reasons.push(`Gallery image "${g.id}" must be an approved image asset belonging to this invitation`);
            }
          }
        }
      }

      if (reasons.length > 0) {
        return c.json({ error: 'Publication requirements unmet', reasons }, 422);
      }

      const now = Date.now();
      const approvalRecord = {
        timestamp: now,
        actorId: actor.id,
        attestations,
        invitationUpdatedAt: now,
      };

      sqlite.transaction(() => {
        db.update(schema.invitations)
          .set({
            isPublished: true,
            updatedAt: now,
          })
          .where(eq(schema.invitations.id, id))
          .run();

        const existingApproval = db.select().from(schema.invitationTemplateFields)
          .where(and(
            eq(schema.invitationTemplateFields.invitationId, id),
            eq(schema.invitationTemplateFields.fieldKey, 'yt_publication_approval'),
          ))
          .get();

        if (existingApproval) {
          db.update(schema.invitationTemplateFields)
            .set({ fieldValue: JSON.stringify(approvalRecord) })
            .where(eq(schema.invitationTemplateFields.id, existingApproval.id))
            .run();
        } else {
          db.insert(schema.invitationTemplateFields).values({
            id: `tf-yt-pub-${randomUUID()}`,
            invitationId: id,
            fieldKey: 'yt_publication_approval',
            fieldValue: JSON.stringify(approvalRecord),
          }).run();
        }
      })();

      return c.json({ success: true, isPublished: true });
    } else {
      if (body.confirmation !== inv.slug && body.confirmation !== 'PUBLISH') {
        return c.json({ error: 'Confirmation mismatch' }, 400);
      }
      db.update(schema.invitations)
        .set({
          isPublished: true,
          updatedAt: Date.now(),
        })
        .where(eq(schema.invitations.id, id))
        .run();

      return c.json({ success: true, isPublished: true });
    }
  } else {
    const now = Date.now();
    sqlite.transaction(() => {
      db.update(schema.invitations)
        .set({
          isPublished: false,
          updatedAt: now,
        })
        .where(eq(schema.invitations.id, id))
        .run();

      db.delete(schema.invitationTemplateFields)
        .where(and(
          eq(schema.invitationTemplateFields.invitationId, id),
          eq(schema.invitationTemplateFields.fieldKey, 'yt_publication_approval'),
        ))
        .run();
    })();

    return c.json({ success: true, isPublished: false });
  }
});

// PATCH /api/admin/invitations/:id
adminInvitationsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<any>();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Invalid invitation update payload' }, 400);
  }
  const { heroPhotoAssetId, closingPhotoAssetId, galleryVideoUrl, loveStory } = body;
  const editableFields = [
    'title', 'openingGreetingText', 'closingText', 'quoteText', 'quoteSource',
    'coverGuestLabelDefault', 'hashtag', 'theme', 'coupleDisplayName',
    'coverPhotoAssetId',
  ] as const;
  const invitationFields: Record<string, unknown> = {};
  for (const key of editableFields) if (Object.hasOwn(body, key)) invitationFields[key] = body[key];

  const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, id)).get();
  if (!inv) {
    return c.json({ error: 'Invitation not found' }, 404);
  }

  let validatedLoveStory = null;
  if (loveStory !== undefined) {
    if (inv.slug !== 'anggi-ivan') {
      return c.json({ error: 'Love Story editing is not enabled for this invitation' }, 400);
    }
    validatedLoveStory = parseLoveStoryItems(loveStory);
    if (!validatedLoveStory) {
      return c.json({ error: 'Love Story must contain the three valid ordered story items' }, 400);
    }
    for (const item of validatedLoveStory) {
      if (!item.photoAssetId) continue;
      const asset = db.select().from(schema.invitationAssets)
        .where(and(
          eq(schema.invitationAssets.id, item.photoAssetId),
          eq(schema.invitationAssets.invitationId, id),
          eq(schema.invitationAssets.kind, 'image'),
        ))
        .get();
      if (!asset) {
        return c.json({ error: 'Love Story photos must be image assets belonging to this invitation' }, 400);
      }
    }
  }

  for (const assetId of [invitationFields.coverPhotoAssetId, heroPhotoAssetId, closingPhotoAssetId]) {
    if (assetId === undefined || assetId === null) continue;
    if (typeof assetId !== 'string' || !db.select().from(schema.invitationAssets).where(and(
      eq(schema.invitationAssets.id, assetId),
      eq(schema.invitationAssets.invitationId, id),
      eq(schema.invitationAssets.kind, 'image'),
    )).get()) return c.json({ error: 'Image asset not found for invitation' }, 400);
  }

  if (heroPhotoAssetId !== undefined) {
    if (heroPhotoAssetId === null) {
      db.delete(schema.invitationTemplateFields)
        .where(and(eq(schema.invitationTemplateFields.invitationId, id), eq(schema.invitationTemplateFields.fieldKey, 'hero_photo_asset_id')))
        .run();
    } else {
      const existing = db.select().from(schema.invitationTemplateFields)
        .where(and(eq(schema.invitationTemplateFields.invitationId, id), eq(schema.invitationTemplateFields.fieldKey, 'hero_photo_asset_id')))
        .get();
      if (existing) {
        db.update(schema.invitationTemplateFields)
          .set({ fieldValue: String(heroPhotoAssetId) })
          .where(eq(schema.invitationTemplateFields.id, existing.id))
          .run();
      } else {
        db.insert(schema.invitationTemplateFields).values({
          id: `tf-hero-${randomUUID()}`,
          invitationId: id,
          fieldKey: 'hero_photo_asset_id',
          fieldValue: String(heroPhotoAssetId),
        }).run();
      }
    }
  }

  if (closingPhotoAssetId !== undefined) {
    if (closingPhotoAssetId === null) {
      db.delete(schema.invitationTemplateFields)
        .where(and(eq(schema.invitationTemplateFields.invitationId, id), eq(schema.invitationTemplateFields.fieldKey, 'closing_photo_asset_id')))
        .run();
    } else {
      const existing = db.select().from(schema.invitationTemplateFields)
        .where(and(eq(schema.invitationTemplateFields.invitationId, id), eq(schema.invitationTemplateFields.fieldKey, 'closing_photo_asset_id')))
        .get();
      if (existing) {
        db.update(schema.invitationTemplateFields)
          .set({ fieldValue: String(closingPhotoAssetId) })
          .where(eq(schema.invitationTemplateFields.id, existing.id))
          .run();
      } else {
        db.insert(schema.invitationTemplateFields).values({
          id: `tf-closing-${randomUUID()}`,
          invitationId: id,
          fieldKey: 'closing_photo_asset_id',
          fieldValue: String(closingPhotoAssetId),
        }).run();
      }
    }
  }

  if (galleryVideoUrl !== undefined) {
    if (galleryVideoUrl === null || String(galleryVideoUrl).trim() === '') {
      db.delete(schema.invitationTemplateFields)
        .where(and(eq(schema.invitationTemplateFields.invitationId, id), eq(schema.invitationTemplateFields.fieldKey, 'gallery_video_url')))
        .run();
    } else {
      const existing = db.select().from(schema.invitationTemplateFields)
        .where(and(eq(schema.invitationTemplateFields.invitationId, id), eq(schema.invitationTemplateFields.fieldKey, 'gallery_video_url')))
        .get();
      if (existing) {
        db.update(schema.invitationTemplateFields)
          .set({ fieldValue: String(galleryVideoUrl).trim() })
          .where(eq(schema.invitationTemplateFields.id, existing.id))
          .run();
      } else {
        db.insert(schema.invitationTemplateFields).values({
          id: `tf-galvid-${randomUUID()}`,
          invitationId: id,
          fieldKey: 'gallery_video_url',
          fieldValue: String(galleryVideoUrl).trim(),
        }).run();
      }
    }
  }

  const patchNow = Date.now();
  if (Object.keys(invitationFields).length > 0) {
    db.update(schema.invitations)
      .set({
        ...invitationFields,
        updatedAt: patchNow,
      })
      .where(eq(schema.invitations.id, id))
      .run();
  } else {
    db.update(schema.invitations)
      .set({ updatedAt: patchNow })
      .where(eq(schema.invitations.id, id))
      .run();
  }

  const existingApproval = db.select().from(schema.invitationTemplateFields)
    .where(and(
      eq(schema.invitationTemplateFields.invitationId, id),
      eq(schema.invitationTemplateFields.fieldKey, 'yt_publication_approval'),
    ))
    .get();
  if (existingApproval) {
    try {
      const parsed = JSON.parse(existingApproval.fieldValue);
      parsed.stale = true;
      parsed.staleAt = patchNow;
      db.update(schema.invitationTemplateFields)
        .set({ fieldValue: JSON.stringify(parsed) })
        .where(eq(schema.invitationTemplateFields.id, existingApproval.id))
        .run();
    } catch {}
  }

  if (validatedLoveStory) {
    const currentFields = db.select().from(schema.invitationTemplateFields)
      .where(and(
        eq(schema.invitationTemplateFields.invitationId, id),
        eq(schema.invitationTemplateFields.fieldKey, LOVE_STORY_FIELD_KEY),
      ))
      .all();
    const fieldValue = JSON.stringify(validatedLoveStory.map(({ photoUrl: _photoUrl, ...item }) => item));
    sqlite.transaction(() => {
      if (currentFields[0]) {
        db.update(schema.invitationTemplateFields)
          .set({ fieldValue })
          .where(eq(schema.invitationTemplateFields.id, currentFields[0].id))
          .run();
        for (const duplicate of currentFields.slice(1)) {
          db.delete(schema.invitationTemplateFields)
            .where(eq(schema.invitationTemplateFields.id, duplicate.id))
            .run();
        }
      } else {
        db.insert(schema.invitationTemplateFields).values({
          id: `tf-love-story-${randomUUID()}`,
          invitationId: id,
          fieldKey: LOVE_STORY_FIELD_KEY,
          fieldValue,
        }).run();
      }
    })();
  }

  return c.json({ success: true });
});
