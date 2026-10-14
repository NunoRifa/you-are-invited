import { Hono } from 'hono';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

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
  return new Response(fileBuffer, {
    headers: {
      'Content-Type': asset.mimeType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});
