import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { Hono } from 'hono';
import { db, sqlite } from '../../db/client.js';
import * as schema from '../../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const AUDIO_MIME_TYPES: Record<string, string[]> = {
  '.mp3': ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'audio/x-mp3'],
  '.m4a': ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
  '.wav': ['audio/wav', 'audio/x-wav', 'audio/wave'],
  '.ogg': ['audio/ogg', 'application/ogg'],
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

const AUDIO_SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  '.mp3': isValidMp3,
  '.m4a': (bytes) => bytes.length >= 8 && bytes.subarray(4, 8).toString() === 'ftyp',
  '.wav': (bytes) => bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE',
  '.ogg': (bytes) => bytes.length >= 4 && bytes.subarray(0, 4).toString() === 'OggS',
};

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
  const assets = db.select().from(schema.invitationAssets).where(eq(schema.invitationAssets.invitationId, id)).all();
  const gallery = db.select().from(schema.galleryImages).where(eq(schema.galleryImages.invitationId, id)).orderBy(schema.galleryImages.sortOrder).all();

  const heroField = fields.find((f) => f.fieldKey === 'hero_photo_asset_id');
  const closingField = fields.find((f) => f.fieldKey === 'closing_photo_asset_id');
  const galleryVideoField = fields.find((f) => f.fieldKey === 'gallery_video_url');
  const musicAsset = assets.find((a) => a.kind === 'audio');

  return c.json({
    invitation: {
      ...inv,
      coverPhotoUrl: inv.coverPhotoAssetId ? `/api/assets/${inv.coverPhotoAssetId}` : null,
      heroPhotoAssetId: heroField?.fieldValue || null,
      heroPhotoUrl: heroField?.fieldValue ? `/api/assets/${heroField.fieldValue}` : null,
      closingPhotoAssetId: closingField?.fieldValue || null,
      closingPhotoUrl: closingField?.fieldValue ? `/api/assets/${closingField.fieldValue}` : null,
      galleryVideoUrl: galleryVideoField?.fieldValue || null,
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
  });
});

// POST /api/admin/invitations/:id/assets - Multipart file upload
adminInvitationsRouter.post('/:id/assets', async (c) => {
  const invitationId = c.req.param('id');
  const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, invitationId)).get();
  if (!inv) return c.json({ error: 'Invitation not found' }, 404);

  const body = await c.req.parseBody();
  const file = body['file'];
  const kind = (body['kind'] as 'image' | 'audio' | 'font') || 'image';

  if (!['image', 'audio', 'font'].includes(kind)) return c.json({ error: 'Unsupported asset kind' }, 400);
  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file uploaded' }, 400);
  }

  const originalFilename = file.name || (kind === 'audio' ? 'music.mp3' : 'image.jpg');
  const ext = (path.extname(originalFilename) || (kind === 'audio' ? '.mp3' : '.jpg')).toLowerCase();
  const mimeType = (file.type || '').toLowerCase();

  if (kind === 'audio') {
    if (file.size > MAX_AUDIO_BYTES) {
      return c.json({ error: 'Audio file exceeds the 20 MiB limit', code: 'audio_size_exceeded' }, 413);
    }
    const allowedMimes = AUDIO_MIME_TYPES[ext];
    // Allow standard audio MIME types, plus application/octet-stream if file extension is audio (some OS/browsers send octet-stream)
    const isValidMime = allowedMimes?.includes(mimeType) || (mimeType === 'application/octet-stream' && allowedMimes !== undefined);
    if (!isValidMime) {
      return c.json({ error: 'Unsupported audio format. Use MP3, M4A, WAV, or OGG.', code: 'unsupported_audio_mime' }, 415);
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

  const assetId = `ast-${randomUUID()}`;
  const safeFilename = `${assetId}${ext}`;
  const relativePath = `storage/uploads/${invitationId}/${safeFilename}`;
  const defaultMime = kind === 'audio' ? 'audio/mpeg' : (kind === 'font' ? 'font/woff2' : 'image/jpeg');
  const normalizedMime = mimeType || defaultMime;
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
    return c.json({ error: 'Failed to save uploaded file. Existing music was not changed.' }, 500);
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
    .where(eq(schema.invitations.coverPhotoAssetId, assetId))
    .run();

  db.update(schema.couples)
    .set({ photoAssetId: null })
    .where(eq(schema.couples.photoAssetId, assetId))
    .run();

  db.delete(schema.galleryImages)
    .where(eq(schema.galleryImages.assetId, assetId))
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
  const body = await c.req.json<any>();
  const { heroPhotoAssetId, closingPhotoAssetId, galleryVideoUrl, ...invitationFields } = body;

  const inv = db.select().from(schema.invitations).where(eq(schema.invitations.id, id)).get();
  if (!inv) {
    return c.json({ error: 'Invitation not found' }, 404);
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

  if (Object.keys(invitationFields).length > 0) {
    db.update(schema.invitations)
      .set({
        ...invitationFields,
        updatedAt: Date.now(),
      })
      .where(eq(schema.invitations.id, id))
      .run();
  }

  return c.json({ success: true });
});
