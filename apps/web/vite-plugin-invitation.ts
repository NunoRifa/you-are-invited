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

  return {
    name: 'invitation-route',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = (req.url || '').match(/^\/i\/([a-zA-Z0-9_-]+)(\/)?(\?.*)?$/);
        if (!match) return next();

        const slug = match[1];
        const file = path.join(publicDir, slug, 'index.html');
        if (!fs.existsSync(file)) return next();

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(fs.readFileSync(file));
      });
    },
    // Emit a copy of each template at /i/<slug>/index.html for production builds
    writeBundle() {
      if (!fs.existsSync(publicDir)) return;
      for (const slug of fs.readdirSync(publicDir)) {
        const src = path.join(publicDir, slug, 'index.html');
        if (!fs.existsSync(src)) continue;
        const outDir = path.resolve(__dirname, 'dist/i', slug);
        fs.mkdirSync(outDir, { recursive: true });
        fs.copyFileSync(src, path.join(outDir, 'index.html'));
      }
    },
  };
}
