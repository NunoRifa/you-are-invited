import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

/**
 * Serves the converted standalone template HTML at /i/:slug.
 *
 * The templates under public/templates/<slug>/index.html are the ORIGINAL
 * vendor markup with only asset URLs rewritten to the local mirror. They must
 * not be modified — see CLAUDE.md ("Zero Visual Modification").
 */
export function invitationRoutePlugin(): Plugin {
  const publicDir = path.resolve(__dirname, 'public/templates');
  const dbPath = path.resolve(__dirname, '../../storage/db/app.sqlite');

  function getInvitationInfo(slug: string): { isPublished: boolean; templateKey: string } | null {
    try {
      if (fs.existsSync(dbPath)) {
        // Safe dynamic require so building in frontend container does not require better-sqlite3
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Database = require('better-sqlite3');
        const db = new Database(dbPath, { readonly: true });
        const row = db.prepare('SELECT is_published, template_key FROM invitations WHERE slug = ?').get(slug) as { is_published: number; template_key: string } | undefined;
        db.close();
        if (row) {
          return { isPublished: Boolean(row.is_published), templateKey: row.template_key || 'raden-motion' };
        }
      }
    } catch (e) {}
    if (slug === 'anggi-ivan') return { isPublished: true, templateKey: 'raden-motion' };
    return null;
  }

  return {
    name: 'invitation-route',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Block direct template access in development
        if ((req.url || '').match(/^\/templates(\/.*)?$/)) {
          res.statusCode = 404;
          return res.end('Template direct access not allowed');
        }

        // Close unsafe static production bypass; redirect published clients to /i/:slug
        const prodMatch = (req.url || '').match(/^\/production\/([a-zA-Z0-9_-]+)(\/)?(\?.*)?$/);
        if (prodMatch) {
          const clientSlug = prodMatch[1];
          const info = getInvitationInfo(clientSlug);
          if (!info || !info.isPublished) {
            res.statusCode = 404;
            return res.end('Invitation not found');
          }
          res.writeHead(301, { Location: `/i/${clientSlug}` });
          return res.end();
        }

        const match = (req.url || '').match(/^\/i\/([a-zA-Z0-9_-]+)(\/)?(\?.*)?$/);
        if (!match) return next();

        const slug = match[1];

        // Forward to API backend if available to preserve server-injected per-client social metadata in dev
        const backendUrl = process.env.VITE_API_URL || 'http://localhost:3000';
        fetch(`${backendUrl}${req.url}`).then(async (apiRes) => {
          if (apiRes.status === 200) {
            res.setHeader('Content-Type', apiRes.headers.get('content-type') || 'text/html; charset=utf-8');
            return res.end(await apiRes.text());
          }
          if (apiRes.status === 404) {
            res.statusCode = 404;
            return res.end('Invitation not found');
          }
          throw new Error('Fallback to local file');
        }).catch(() => {
          const info = getInvitationInfo(slug);
          if (!info || !info.isPublished) {
            // Never serve draft HTML from disk
            res.statusCode = 404;
            return res.end('Invitation not found');
          }

          // 1. Check if client has a production subfolder first (Q1 & Q2)
          const clientProdFile = path.resolve(__dirname, 'public/production', slug, 'index.html');
          if (fs.existsSync(clientProdFile)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.end(fs.readFileSync(clientProdFile));
          }

          // 2. Check if it matches a template
          let file = path.join(publicDir, slug, 'index.html');
          if (!fs.existsSync(file)) {
            file = path.join(publicDir, info.templateKey, 'index.html');
          }
          if (!fs.existsSync(file)) return next();

          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(fs.readFileSync(file));
        });
      });
    },
    // Emit only verified published client production subfolders
    writeBundle() {
      // Client production subfolders -> dist/i/<slug>/index.html only for published clients
      const prodDir = path.resolve(__dirname, 'public/production');
      if (fs.existsSync(prodDir)) {
        for (const clientSlug of fs.readdirSync(prodDir)) {
          const info = getInvitationInfo(clientSlug);
          if (!info || !info.isPublished) continue;
          const src = path.join(prodDir, clientSlug, 'index.html');
          if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue;

          // Route /i/<slug>
          const outDirI = path.resolve(__dirname, 'dist/i', clientSlug);
          fs.mkdirSync(outDirI, { recursive: true });
          fs.copyFileSync(src, path.join(outDirI, 'index.html'));
        }
      }
    },
  };
}
