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

  // Resolve disk path
  let fullPath = asset.storagePath;
  if (!path.isAbsolute(fullPath)) {
    fullPath = path.resolve(process.cwd(), fullPath);
  }

  if (!fs.existsSync(fullPath)) {
    // Check fallback in root storage/uploads directory
    const altPath = path.resolve(process.cwd(), 'storage/uploads', path.basename(fullPath));
    if (fs.existsSync(altPath)) {
      fullPath = altPath;
    } else {
      return c.json({ error: 'Asset file not found on disk' }, 404);
    }
  }

  const fileBuffer = fs.readFileSync(fullPath);
  return new Response(fileBuffer, {
    headers: {
      'Content-Type': asset.mimeType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});
