import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';

export const invitationPageRouter = new Hono();
const origin = 'https://you-are-invited.my.id';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

invitationPageRouter.get('/:slug', (c) => {
  const slug = c.req.param('slug');
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return c.notFound();
  const invitation = db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).get();
  if (!invitation || !invitation.isPublished) return c.notFound();

  const pages = process.env.INVITATION_PAGE_DIR || [
    path.resolve(process.cwd(), 'apps/api/pages'),
    path.resolve(process.cwd(), '../web/public'),
    path.resolve(process.cwd(), 'apps/web/public'),
  ].find((directory) => fs.existsSync(path.join(directory, 'templates'))) || '';
  const clientPage = path.join(pages, 'production', slug, 'index.html');
  const templatePage = path.join(pages, 'templates', invitation.templateKey, 'index.html');
  const page = fs.existsSync(clientPage) ? clientPage : templatePage;
  if (!pages || !fs.existsSync(page)) return c.text('Invitation template not available', 500);

  const asset = invitation.coverPhotoAssetId && db.select().from(schema.invitationAssets)
    .where(and(
      eq(schema.invitationAssets.id, invitation.coverPhotoAssetId),
      eq(schema.invitationAssets.invitationId, invitation.id),
      eq(schema.invitationAssets.kind, 'image'),
    )).get();
  const names = invitation.coupleDisplayName?.trim() || invitation.title.replace(/^Pernikahan\s+/i, '');
  const title = escapeHtml(`Undangan Pernikahan ${names}`);
  const description = escapeHtml(`Dengan penuh kebahagiaan, ${names} mengundang Anda untuk hadir dan memberikan doa restu pada acara pernikahan kami.`);
  const url = `${origin}/i/${slug}`;
  const original = fs.readFileSync(page, 'utf8');
  const headEnd = original.search(/<\/head\s*>/i);
  if (headEnd < 0) return c.text('Invalid invitation template', 500);
  const sourceHead = original.slice(0, headEnd);
  const templateImage = sourceHead.match(/<meta\b[^>]*\bproperty\s*=\s*["']og:image["'][^>]*>/i)?.[0]
    .match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
  const fallback = templateImage?.startsWith('/template-assets/')
    && fs.existsSync(path.join(pages, templateImage.slice(1))) ? `${origin}${templateImage}` : null;
  const image = asset && /^image\/(png|jpeg|webp)$/.test(asset.mimeType)
    ? `${origin}/api/assets/${encodeURIComponent(asset.id)}` : fallback;
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
    `<link rel="canonical" href="${url}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    ...(image ? [`<meta property="og:image" content="${image}">`] : []),
    `<meta property="og:url" content="${url}">`,
    '<meta property="og:site_name" content="You Are Invited">',
    '<meta property="og:locale" content="id_ID">',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    ...(image ? [`<meta name="twitter:image" content="${image}">`] : []),
  ].join('\n');

  // ponytail: Metadata injection stops at </head>; leave template body and visual markup intact.
  const head = sourceHead
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, '')
    .replace(/<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, (tag) => /\b(?:name|property)\s*=\s*["'](?:description|robots|og:[^"']+|twitter:[^"']+|article:[^"']+)["']/i.test(tag) ? '' : tag);
  return c.html(`${head}${tags}\n${original.slice(headEnd)}`, 200, {
    'Cache-Control': 'public, max-age=0, must-revalidate',
  });
});
