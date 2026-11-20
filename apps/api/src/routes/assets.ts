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

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': isDraft ? 'private, no-store' : 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(fileBuffer.length),
  };
  const range = c.req.header('Range');
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const size = fileBuffer.length;
    let start = 0;
    let end = size - 1;
    if (match && (match[1] || match[2])) {
      if (!match[1]) start = Math.max(0, size - Number(match[2]));
      else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(end, Number(match[2]));
      }
    }
    if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}`, 'Content-Length': '0' } });
    }
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    headers['Content-Length'] = String(end - start + 1);
    return new Response(fileBuffer.subarray(start, end + 1), { status: 206, headers });
  }
  return new Response(fileBuffer, { headers });
});
