const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Load environment and API app
process.env.PORT = '3999';
const { invitationsRouter } = require('../apps/api/dist/routes/invitations.js');
const { assetsRouter } = require('../apps/api/dist/routes/assets.js');
const { adminInvitationsRouter } = require('../apps/api/dist/routes/admin/invitations.js');

const Hono = require('hono').Hono;
const app = new Hono();
app.route('/api/invitations', invitationsRouter);
app.route('/api/assets', assetsRouter);
app.route('/api/admin/invitations', adminInvitationsRouter);

async function runTests() {
  console.log('--- 1. Testing Public Invitation GET /api/invitations/anggi-ivan ---');
  const res = await app.request('/api/invitations/anggi-ivan');
  assert.strictEqual(res.status, 200, 'Public invitation should return 200');
  const data = await res.json();

  console.log('Cover Photo URL:', data.invitation.coverPhotoUrl);
  console.log('Hero Photo URL:', data.invitation.heroPhotoUrl);
  console.log('Closing Photo URL:', data.invitation.closingPhotoUrl);
  console.log('Couples Photos:', data.couples.map(c => ({ role: c.role, photoUrl: c.photoUrl })));

  assert.strictEqual(data.invitation.coverPhotoUrl, '/api/assets/ast-anggi-ivan-cover');
  assert.strictEqual(data.invitation.heroPhotoUrl, '/api/assets/ast-anggi-ivan-hero');
  assert.strictEqual(data.invitation.closingPhotoUrl, '/api/assets/ast-anggi-ivan-closing');

  const groom = data.couples.find(c => c.role === 'groom');
  const bride = data.couples.find(c => c.role === 'bride');
  assert.strictEqual(groom.photoUrl, '/api/assets/ast-anggi-ivan-groom');
  assert.strictEqual(bride.photoUrl, '/api/assets/ast-anggi-ivan-bride');

  console.log('✅ Public endpoint returns all 5 distinct photo URLs!');

  console.log('\n--- 2. Testing Asset Serving GET /api/assets/:id for all 5 photos ---');
  const assetIds = [
    'ast-anggi-ivan-cover',
    'ast-anggi-ivan-hero',
    'ast-anggi-ivan-bride',
    'ast-anggi-ivan-groom',
    'ast-anggi-ivan-closing'
  ];

  for (const aid of assetIds) {
    const aRes = await app.request(`/api/assets/${aid}`);
    assert.strictEqual(aRes.status, 200, `Asset ${aid} should return 200`);
    assert.strictEqual(aRes.headers.get('content-type'), 'image/png');
    const buf = await aRes.arrayBuffer();
    assert.ok(buf.byteLength > 10000, `Asset ${aid} should contain valid image bytes (got ${buf.byteLength})`);
    console.log(`✅ Asset ${aid} verified (${buf.byteLength} bytes)`);
  }

  console.log('\n--- 3. Testing Admin GET /api/admin/invitations/inv-anggi-ivan ---');
  const adminRes = await app.request('/api/admin/invitations/inv-anggi-ivan');
  assert.strictEqual(adminRes.status, 200);
  const adminData = await adminRes.json();
  assert.strictEqual(adminData.invitation.coverPhotoUrl, '/api/assets/ast-anggi-ivan-cover');
  assert.strictEqual(adminData.invitation.heroPhotoUrl, '/api/assets/ast-anggi-ivan-hero');
  assert.strictEqual(adminData.invitation.closingPhotoUrl, '/api/assets/ast-anggi-ivan-closing');
  console.log('✅ Admin GET returns all photo URLs correctly!');

  console.log('\n--- 4. Testing Admin PATCH and Reset for template fields ---');
  // Test updating heroPhotoAssetId to null then back
  const patchRes = await app.request('/api/admin/invitations/inv-anggi-ivan', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ heroPhotoAssetId: null })
  });
  assert.strictEqual(patchRes.status, 200);

  const checkNullRes = await app.request('/api/admin/invitations/inv-anggi-ivan');
  const checkNullData = await checkNullRes.json();
  assert.strictEqual(checkNullData.invitation.heroPhotoAssetId, null);
  console.log('✅ Clearing hero photo via admin PATCH verified!');

  // Restore heroPhotoAssetId
  const restoreRes = await app.request('/api/admin/invitations/inv-anggi-ivan', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ heroPhotoAssetId: 'ast-anggi-ivan-hero' })
  });
  assert.strictEqual(restoreRes.status, 200);

  const checkRestoreRes = await app.request('/api/admin/invitations/inv-anggi-ivan');
  const checkRestoreData = await checkRestoreRes.json();
  assert.strictEqual(checkRestoreData.invitation.heroPhotoAssetId, 'ast-anggi-ivan-hero');
  console.log('✅ Restoring hero photo via admin PATCH verified!');

  console.log('\n========================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED 100%! 🎉');
  console.log('========================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

