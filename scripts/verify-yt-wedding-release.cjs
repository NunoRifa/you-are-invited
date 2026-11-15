const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'yai-release-'));
const dbPath = path.join(temp, 'release.sqlite');
let db;
try {
  // Check real bundle and proxy rules without opening production DB or changing publication state.
  const html = fs.readFileSync(path.join(root, 'apps/api/private-pages/yt-wedding/index.html'), 'utf8');
  const nginx = fs.readFileSync(path.join(root, 'docker/nginx.conf'), 'utf8');
  const vite = fs.readFileSync(path.join(root, 'apps/web/vite-plugin-invitation.ts'), 'utf8');
  const built = path.join(root, 'apps/web/dist/i/riska-rafli');
  for (const marker of ['chara.id', 'static.cloudflareinsights.com', 'api.qrserver.com', 'handle_rsvp.json']) {
    assert(!html.includes(marker), `Forbidden template request: ${marker}`);
  }
  assert.match(nginx, /location \/i\/\s*\{\s*proxy_pass http:\/\/api:3000;/);
  assert.match(nginx, /location \/templates\/\s*\{\s*return 404;/);
  assert.match(nginx, /location ~ \^\/production\//);
  assert.match(vite, /Block direct template access in development/);
  assert(!fs.existsSync(built), 'Built output exposes a direct Riska invitation');
  // Boot actual app schema and seed against isolated DB; never use repository storage.
  const probe = spawnSync(process.execPath, ['--import', 'tsx', '-e', `
    const { sqlite } = await import('./apps/api/src/db/client.ts');
    const { seedTemplates } = await import('./apps/api/src/db/seed/templates.ts');
    sqlite.prepare('INSERT INTO admin_users (id,email,password_hash,role,created_at) VALUES (?,?,?,?,?)').run('release-admin','release@test.local','unused','super_admin',Date.now());
    await seedTemplates();
    sqlite.close();
  `], { cwd: root, env: { ...process.env, DATABASE_URL: dbPath }, encoding: 'utf8' });
  assert.equal(probe.status, 0, `Actual schema/seed failed: ${probe.stderr || probe.stdout}`);
  db = new Database(dbPath, { readonly: true });
  const row = db.prepare('SELECT slug, is_published, template_key, owner_user_id FROM invitations WHERE slug = ?').get('riska-rafli');
  assert.deepEqual(row, { slug: 'riska-rafli', is_published: 0, template_key: 'yt-wedding', owner_user_id: 'release-admin' });
  console.error('Actual app schema/seed draft check passed. Nginx/Vite HTTP bypass behavior UNTESTED. BLOCKED from publication: media rights, trademark, client content, fonts and visual parity lack approval. No publish or deploy performed.');
  process.exitCode = 1;
} finally {
  db?.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
