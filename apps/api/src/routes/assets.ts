import { Hono } from 'hono';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import { canManageInvitation, getAdminActor } from './admin/authorization.js';

export const assetsRouter = new Hono();

assetsRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  const asset = db
    .select()
    .from(schema.invitationAssets)
    .where(eq(schema.invitationAssets.id, id))
    .get();

  if (!asset) {
    return c.json({ error: 'Asset not found' }, 404);
  }

  const invitation = db
    .select()
    .from(schema.invitations)
    .where(eq(schema.invitations.id, asset.invitationId))
    .get();

  const isDraft = !invitation || !invitation.isPublished;
  if (isDraft) {
    const actor = getAdminActor(c.req.header('Cookie'));
    if (!actor || !invitation || !canManageInvitation(actor, invitation)) {
      return c.json({ error: 'Asset not found' }, 404);
    }
  }

  // Resolve disk path across multiple possible base directories
  const filename = path.basename(asset.storagePath);
  const candidates = [
    path.resolve(process.cwd(), asset.storagePath),
    path.resolve(process.cwd(), 'apps/api', asset.storagePath),
    path.resolve(process.cwd(), '../', asset.storagePath),
    path.resolve(process.cwd(), 'storage/uploads', asset.invitationId, filename),
    path.resolve(process.cwd(), 'apps/api/storage/uploads', asset.invitationId, filename),
    path.resolve(process.cwd(), '../storage/uploads', asset.invitationId, filename),
    path.resolve(process.cwd(), 'storage/uploads', filename),
    path.resolve(process.cwd(), 'apps/api/storage/uploads', filename),
  ];

  let resolvedPath: string | null = null;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      resolvedPath = candidate;
      break;
    }
  }

  if (!resolvedPath) {
    return c.json({ error: 'Asset file not found on disk' }, 404);
  }

  const fileBuffer = fs.readFileSync(resolvedPath);
  let contentType = asset.mimeType || 'application/octet-stream';
  if (asset.kind === 'video' || resolvedPath.endsWith('.mp4') || asset.storagePath.endsWith('.mp4')) {
    contentType = 'video/mp4';
  }

  return new Response(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': isDraft ? 'private, no-store' : 'public, max-age=31536000, immutable',
    },
  });
});
