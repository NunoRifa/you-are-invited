import { Hono } from 'hono';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';
import type { TemplateListItem } from '@you-are-invited/shared-types';

export const templatesRouter = new Hono();

templatesRouter.get('/', (c) => {
  const list = db
    .select()
    .from(schema.templates)
    .where(eq(schema.templates.isActive, true))
    .all();

  const formatted: TemplateListItem[] = list.map((t) => ({
    id: t.id,
    displayName: t.displayName,
    previewImagePath: t.previewImagePath ?? undefined,
    supportsPantun: t.supportsPantun,
    supportsHeroVideo: t.supportsHeroVideo,
    quoteBlockPosition: t.quoteBlockPosition,
    galleryVideoType: t.galleryVideoType,
    isActive: t.isActive,
  }));

  return c.json(formatted);
});
