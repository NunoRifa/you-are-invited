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

export const ALLOWED_ASSET_EXTENSIONS: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.json': 'application/json',
  '.map': 'application/json',
};

export function resolveSafeTemplateAsset(
  invitation: typeof schema.invitations.$inferSelect,
  requestedFile: string,
): { filePath: string; mimeType: string } | null {
  if (!requestedFile || requestedFile.includes('..') || requestedFile.includes('\\') || requestedFile.startsWith('/')) {
    return null;
  }
  const ext = path.extname(requestedFile).toLowerCase();
  const mimeType = ALLOWED_ASSET_EXTENSIONS[ext];
  if (!mimeType) return null;

  const pagesDir = process.env.INVITATION_PAGE_DIR || [
    path.resolve(process.cwd(), 'apps/api/pages'),
    path.resolve(process.cwd(), '../web/public'),
    path.resolve(process.cwd(), 'apps/web/public'),
  ].find((directory) => fs.existsSync(path.join(directory, 'templates'))) || '';

  const candidates: string[] = [];
  if (invitation.templateKey === 'yt-wedding') {
    candidates.push(path.resolve(process.cwd(), 'apps/api/private-pages/yt-wedding/assets'));
    candidates.push(path.resolve(process.cwd(), 'private-pages/yt-wedding/assets'));
  }
  if (pagesDir) {
    candidates.push(path.resolve(pagesDir, 'production', invitation.slug, 'assets'));
    candidates.push(path.resolve(pagesDir, 'templates', invitation.templateKey, 'assets'));
  }
  candidates.push(path.resolve(process.cwd(), 'apps/api/private-pages', invitation.templateKey, 'assets'));
  candidates.push(path.resolve(process.cwd(), 'private-pages', invitation.templateKey, 'assets'));

  for (const baseDir of candidates) {
    if (!fs.existsSync(baseDir)) continue;
    const fullPath = path.resolve(baseDir, requestedFile);
    if (!fullPath.startsWith(baseDir + path.sep)) continue;
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return { filePath: fullPath, mimeType };
    }
  }
  return null;
}

export function renderInvitationHtml(
  invitation: typeof schema.invitations.$inferSelect,
  options?: { isPreview?: boolean },
): { status: 200 | 500; html?: string; error?: string; headers: Record<string, string> } {
  const isPreview = Boolean(options?.isPreview);
  const pages = process.env.INVITATION_PAGE_DIR || [
    path.resolve(process.cwd(), 'apps/api/pages'),
    path.resolve(process.cwd(), '../web/public'),
    path.resolve(process.cwd(), 'apps/web/public'),
  ].find((directory) => fs.existsSync(path.join(directory, 'templates'))) || '';

  const clientPage = pages ? path.join(pages, 'production', invitation.slug, 'index.html') : '';
  const templatePage = pages ? path.join(pages, 'templates', invitation.templateKey, 'index.html') : '';
  const privateTemplatePage = path.resolve(process.cwd(), 'apps/api/private-pages', invitation.templateKey, 'index.html');
  const privateTemplatePageAlt = path.resolve(process.cwd(), 'private-pages', invitation.templateKey, 'index.html');

  let page = '';
  if (invitation.templateKey === 'yt-wedding' && fs.existsSync(privateTemplatePage)) page = privateTemplatePage;
  else if (invitation.templateKey === 'yt-wedding' && fs.existsSync(privateTemplatePageAlt)) page = privateTemplatePageAlt;
  else if (clientPage && fs.existsSync(clientPage)) page = clientPage;
  else if (templatePage && fs.existsSync(templatePage)) page = templatePage;
  else if (fs.existsSync(privateTemplatePage)) page = privateTemplatePage;
  else if (fs.existsSync(privateTemplatePageAlt)) page = privateTemplatePageAlt;

  if (!page) {
    return { status: 500, error: 'Invitation template not available', headers: {} };
  }

  const asset = invitation.coverPhotoAssetId && db.select().from(schema.invitationAssets)
    .where(and(
      eq(schema.invitationAssets.id, invitation.coverPhotoAssetId),
      eq(schema.invitationAssets.invitationId, invitation.id),
      eq(schema.invitationAssets.kind, 'image'),
    )).get();
  const names = invitation.coupleDisplayName?.trim() || invitation.title.replace(/^Pernikahan\s+/i, '');
  const title = escapeHtml(`Undangan Pernikahan ${names}`);
  const description = escapeHtml(`Dengan penuh kebahagiaan, ${names} mengundang Anda untuk hadir dan memberikan doa restu pada acara pernikahan kami.`);
  const url = `${origin}/i/${invitation.slug}`;
  const original = fs.readFileSync(page, 'utf8');
  const headEnd = original.search(/<\/head\s*>/i);
  if (headEnd < 0) {
    return { status: 500, error: 'Invalid invitation template', headers: {} };
  }
  const sourceHead = original.slice(0, headEnd);
  const templateImage = sourceHead.match(/<meta\b[^>]*\bproperty\s*=\s*["']og:image["'][^>]*>/i)?.[0]
    .match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
  const fallback = (invitation.slug === invitation.templateKey)
    && templateImage?.startsWith('/template-assets/')
    && fs.existsSync(path.join(pages, templateImage.slice(1))) ? `${origin}${templateImage}` : null;
  const image = asset && /^image\/(png|jpeg|webp)$/.test(asset.mimeType)
    ? `${origin}/api/assets/${encodeURIComponent(asset.id)}` : fallback;

  const tags = isPreview
    ? [
      `<title>${title}</title>`,
      `<meta name="description" content="${description}">`,
      '<meta name="robots" content="noindex, nofollow">',
    ].join('\n')
    : [
      `<title>${title}</title>`,
      `<meta name="description" content="${description}">`,
      `<link rel="canonical" href="${escapeHtml(url)}">`,
      '<meta property="og:type" content="website">',
      `<meta property="og:title" content="${title}">`,
      `<meta property="og:description" content="${description}">`,
      ...(image ? [`<meta property="og:image" content="${escapeHtml(image)}">`] : []),
      `<meta property="og:url" content="${escapeHtml(url)}">`,
      '<meta property="og:site_name" content="You Are Invited">',
      '<meta property="og:locale" content="id_ID">',
      `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
      `<meta name="twitter:title" content="${title}">`,
      `<meta name="twitter:description" content="${description}">`,
      ...(image ? [`<meta name="twitter:image" content="${escapeHtml(image)}">`] : []),
    ].join('\n');

  // ponytail: Metadata injection stops at </head>; leave template body and visual markup intact.
  const head = sourceHead
    .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, '')
    .replace(/<link\b[^>]*>/gi, (tag) => {
      if (/\brel\s*=\s*["']?canonical["']?/i.test(tag)) return '';
      if (/chara\.id|juliet|romeo/i.test(tag)) return '';
      return tag;
    })
    .replace(/<meta\b[^>]*>/gi, (tag) => {
      if (/\b(?:name|property)\s*=\s*["']?(?:description|robots|keywords|author|generator|og:[^"'\s>]+|twitter:[^"'\s>]+|article:[^"'\s>]+)/i.test(tag)) {
        return '';
      }
      if (/chara\.id|juliet|romeo/i.test(tag)) {
        return '';
      }
      return tag;
    })
    .replace(/<!--[\s\S]*?-->/g, (comment) => /chara\.id|httrack/i.test(comment) ? '' : comment);

  const headers: Record<string, string> = isPreview
    ? {
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    }
    : {
      'Cache-Control': 'public, max-age=0, must-revalidate',
    };

  const base = invitation.templateKey === 'yt-wedding'
    ? `<base href="${isPreview ? `/api/admin/invitations/${encodeURIComponent(invitation.id)}/preview/` : `/i/${encodeURIComponent(invitation.slug)}/`}">\n`
    : '';
  return {
    status: 200,
    html: `${head}${base}${tags}\n${original.slice(headEnd)}`,
    headers,
  };
}

invitationPageRouter.get('/:slug/assets/:file{.*}', (c) => {
  const slug = c.req.param('slug');
  const file = c.req.param('file');
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return c.notFound();
  const invitation = db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).get();
  if (!invitation || !invitation.isPublished) return c.notFound();

  const asset = resolveSafeTemplateAsset(invitation, file);
  if (!asset) return c.notFound();
  const fileBuffer = fs.readFileSync(asset.filePath);
  return new Response(fileBuffer, {
    headers: {
      'Content-Type': asset.mimeType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

invitationPageRouter.get('/:slug', (c) => {
  const slug = c.req.param('slug');
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) return c.notFound();
  const invitation = db.select().from(schema.invitations).where(eq(schema.invitations.slug, slug)).get();
  if (!invitation || !invitation.isPublished) return c.notFound();

  const res = renderInvitationHtml(invitation);
  if (res.status !== 200) return c.text(res.error || 'Invitation template not available', res.status);
  return c.html(res.html!, 200, res.headers);
});
