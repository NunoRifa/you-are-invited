import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

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

  function getTemplateKeyForSlug(slug: string): string {
    try {
      if (fs.existsSync(dbPath)) {
        const db = new Database(dbPath, { readonly: true });
        const row = db.prepare('SELECT template_key FROM invitations WHERE slug = ?').get(slug) as { template_key: string } | undefined;
        db.close();
        if (row && row.template_key) return row.template_key;
      }
    } catch (e) {}
    return 'raden-motion';
  }

  return {
    name: 'invitation-route',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const prodMatch = (req.url || '').match(/^\/production\/([a-zA-Z0-9_-]+)(\/)?(\?.*)?$/);
        if (prodMatch) {
          const clientSlug = prodMatch[1];
          const prodFile = path.resolve(__dirname, 'public/production', clientSlug, 'index.html');
          if (fs.existsSync(prodFile)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.end(fs.readFileSync(prodFile));
          }
        }

        const match = (req.url || '').match(/^\/i\/([a-zA-Z0-9_-]+)(\/)?(\?.*)?$/);
        if (!match) return next();

        const slug = match[1];

        // 1. Check if client has a production subfolder first (Q1 & Q2)
        const clientProdFile = path.resolve(__dirname, 'public/production', slug, 'index.html');
        if (fs.existsSync(clientProdFile)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.end(fs.readFileSync(clientProdFile));
        }

        // 2. Check if it matches a template
        let file = path.join(publicDir, slug, 'index.html');
        if (!fs.existsSync(file)) {
          const tplKey = getTemplateKeyForSlug(slug);
          file = path.join(publicDir, tplKey, 'index.html');
        }
        if (!fs.existsSync(file)) return next();

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(fs.readFileSync(file));
      });
    },
    // Emit a copy of templates and client production subfolders
    writeBundle() {
      // 1. Base templates -> dist/i/<tpl>/index.html
      if (fs.existsSync(publicDir)) {
        for (const slug of fs.readdirSync(publicDir)) {
          const src = path.join(publicDir, slug, 'index.html');
          if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue;
          const outDir = path.resolve(__dirname, 'dist/i', slug);
          fs.mkdirSync(outDir, { recursive: true });
          fs.copyFileSync(src, path.join(outDir, 'index.html'));
        }
      }

      // 2. Client production subfolders -> dist/i/<slug>/index.html & dist/production/<slug>/index.html
      const prodDir = path.resolve(__dirname, 'public/production');
      if (fs.existsSync(prodDir)) {
        for (const clientSlug of fs.readdirSync(prodDir)) {
          const src = path.join(prodDir, clientSlug, 'index.html');
          if (!fs.existsSync(src) || !fs.statSync(src).isFile()) continue;

          // Route /i/<slug>
          const outDirI = path.resolve(__dirname, 'dist/i', clientSlug);
          fs.mkdirSync(outDirI, { recursive: true });
          fs.copyFileSync(src, path.join(outDirI, 'index.html'));

          // Route /production/<slug>
          const outDirP = path.resolve(__dirname, 'dist/production', clientSlug);
          fs.mkdirSync(outDirP, { recursive: true });
          fs.copyFileSync(src, path.join(outDirP, 'index.html'));
        }
      }
    },
  };
}
