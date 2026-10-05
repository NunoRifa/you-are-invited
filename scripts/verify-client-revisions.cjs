const assert = require('assert');
const path = require('path');
const fs = require('fs');

async function testRevisions() {
  console.log('=== VERIFYING REVISIONS FOR ANGGI & IVAN ===');

  // 1. Verify Database State
  const Database = require('better-sqlite3');
  const db = new Database(path.resolve(__dirname, '../storage/db/app.sqlite'));

  const inv = db.prepare('SELECT * FROM invitations WHERE slug = ?').get('anggi-ivan');
  assert(inv, 'Invitation anggi-ivan must exist');
  console.log('✓ Invitation exists: ID =', inv.id);
  console.log('✓ Couple display name in DB:', inv.couple_display_name);
  assert.strictEqual(inv.couple_display_name, 'Anggi & Ivan', 'couple_display_name must be "Anggi & Ivan"');

  const couples = db.prepare('SELECT * FROM couples WHERE invitation_id = ?').all(inv.id);
  const bride = couples.find(c => c.role === 'bride');
  const groom = couples.find(c => c.role === 'groom');
  assert(bride, 'Bride must exist');
  assert(groom, 'Groom must exist');
  console.log(`✓ Bride: ${bride.full_name} (${bride.display_name})`);
  console.log(`✓ Groom: ${groom.full_name} (${groom.display_name})`);
  assert.strictEqual(bride.display_name, 'Anggi');
  assert.strictEqual(groom.display_name, 'Ivan');

  // 2. Verify Template Production HTML
  const clientHtmlPath = path.resolve(__dirname, '../apps/web/public/production/anggi-ivan/index.html');
  assert(fs.existsSync(clientHtmlPath), 'Production HTML file for anggi-ivan must exist');
  const htmlContent = fs.readFileSync(clientHtmlPath, 'utf8');

  // Check female-first in hydration code
  assert(htmlContent.includes('text(\'[data-id="4b0b57e"] .elementor-heading-title\', bride.displayName)'), 'Bride must be first in Hero (data-id="4b0b57e")');
  assert(htmlContent.includes('text(\'[data-id="08ea836"] .elementor-heading-title\', groom.displayName)'), 'Groom must be second in Hero (data-id="08ea836")');
  assert(htmlContent.includes('el.textContent = pairDisplayName'), 'Cover gate must use pairDisplayName');
  assert(htmlContent.includes('text(\'[data-id="5fcdb6b"] .elementor-heading-title\', pairDisplayName)'), 'Closing must use pairDisplayName');
  console.log('✓ Production HTML contains correct Female-First hydration (Hero, Cover, Closing)');

  // Check dynamic image hydration functions
  assert(htmlContent.includes('setImage(\'[data-id="379ea7b"]\', inv.coverPhotoUrl)'), 'Cover photo must be hydrated dynamically');
  assert(htmlContent.includes('setImage(\'[data-id="5775dd2"]\', bride.photoUrl)'), 'Bride photo must be hydrated dynamically');
  assert(htmlContent.includes('setImage(\'[data-id="2126396"]\', groom.photoUrl)'), 'Groom photo must be hydrated dynamically');
  assert(htmlContent.includes('payload.gallery'), 'Gallery photos must be hydrated dynamically');
  console.log('✓ Production HTML contains dynamic photo and gallery hydration');

  // 3. Test API Public Endpoint on running backend
  const http = require('http');
  const getJson = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, text: data }); }
      });
    }).on('error', reject);
  });

  const apiRes = await getJson('http://localhost:3000/api/invitations/anggi-ivan');
  assert.strictEqual(apiRes.status, 200, 'API endpoint /api/invitations/anggi-ivan must return 200');
  console.log('✓ Public API returns HTTP 200');
  console.log('  - Title:', apiRes.body.invitation.title);
  console.log('  - Couple Display Name:', apiRes.body.invitation.coupleDisplayName);
  console.log('  - Hashtag:', apiRes.body.invitation.hashtag);
  assert.strictEqual(apiRes.body.invitation.coupleDisplayName, 'Anggi & Ivan');

  const pBride = apiRes.body.couples.find(c => c.role === 'bride');
  const pGroom = apiRes.body.couples.find(c => c.role === 'groom');
  assert.strictEqual(pBride.displayName, 'Anggi');
  assert.strictEqual(pGroom.displayName, 'Ivan');
  console.log('  - Bride Display Name:', pBride.displayName);
  console.log('  - Groom Display Name:', pGroom.displayName);

  // 4. Test Admin Round-Trip Modification
  console.log('\n4. Testing Admin Dashboard Round-Trip Modification...');
  let user = db.prepare('SELECT id FROM admin_users LIMIT 1').get();
  if (!user) {
    user = { id: 'test-admin-user' };
    db.prepare('INSERT INTO admin_users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(user.id, 'testadmin@you-are-invited.test', 'dummy', 'owner', Date.now());
  }

  const sessionId = 'test-sess-rev-' + Date.now();
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sessionId, user.id, Date.now() + 3600000);

  // Patch coupleDisplayName to "Anggi dan Ivan"
  const patchRes1 = await fetch('http://localhost:3000/api/admin/invitations/' + inv.id, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`,
    },
    body: JSON.stringify({ coupleDisplayName: 'Anggi dan Ivan' })
  });
  assert.strictEqual(patchRes1.status, 200, 'Admin patch coupleDisplayName must return 200');

  // Fetch public API to verify dynamic change
  const updatedApi1 = await getJson('http://localhost:3000/api/invitations/anggi-ivan');
  assert.strictEqual(updatedApi1.body.invitation.coupleDisplayName, 'Anggi dan Ivan');
  console.log('✓ Admin successfully changed coupleDisplayName to: "Anggi dan Ivan"');

  // Restore to "Anggi & Ivan"
  const patchRes2 = await fetch('http://localhost:3000/api/admin/invitations/' + inv.id, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`,
    },
    body: JSON.stringify({ coupleDisplayName: 'Anggi & Ivan' })
  });
  assert.strictEqual(patchRes2.status, 200);

  const updatedApi2 = await getJson('http://localhost:3000/api/invitations/anggi-ivan');
  assert.strictEqual(updatedApi2.body.invitation.coupleDisplayName, 'Anggi & Ivan');
  console.log('✓ Restored coupleDisplayName to: "Anggi & Ivan"');

  // Clean up session
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);

  console.log('\n=== ALL CLIENT REVISION CHECKS PASSED ===\n');
}

testRevisions().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
