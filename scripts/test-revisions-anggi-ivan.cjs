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
  console.log('=== TEST REVISI ANGGGI-IVAN (MUSIC, GALLERY & VIDEO) ===\n');

  // --- 1. Initial State Check ---
  console.log('--- 1. Testing GET /api/invitations/anggi-ivan (Initial State) ---');
  const res1 = await app.request('/api/invitations/anggi-ivan');
  assert.strictEqual(res1.status, 200, 'Public invitation should return 200');
  const data1 = await res1.json();
  console.log('  Initial musicUrl:', data1.musicUrl);
  console.log('  Initial gallery items:', data1.gallery.length);
  console.log('  Initial galleryVideoUrl:', data1.templateFields?.gallery_video_url || null);
  console.log('✓ Initial public payload verified');

  console.log('\n--- 2. Testing GET /api/admin/invitations/inv-anggi-ivan (Admin Endpoint) ---');
  const adminRes1 = await app.request('/api/admin/invitations/inv-anggi-ivan');
  assert.strictEqual(adminRes1.status, 200, 'Admin invitation should return 200');
  const adminData1 = await adminRes1.json();
  console.log('  Admin musicAsset:', adminData1.invitation.musicAsset);
  console.log('  Admin musicUrl:', adminData1.invitation.musicUrl);
  console.log('  Admin galleryVideoUrl:', adminData1.invitation.galleryVideoUrl);
  console.log('✓ Admin endpoint returns musicAsset & galleryVideoUrl fields');

  // --- 3. Upload Background Music ---
  console.log('\n--- 3. Testing Upload Custom Background Music (MP3) ---');
  // Create a dummy mp3 buffer
  const dummyMp3Buffer = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00FAKE_AUDIO_STREAM_DATA_TEST_12345');
  const formData1 = new FormData();
  const file1 = new File([dummyMp3Buffer], 'lagu-pernikahan-anggi-ivan.mp3', { type: 'audio/mpeg' });
  formData1.append('file', file1);
  formData1.append('kind', 'audio');

  const uploadMusicRes1 = await app.request('/api/admin/invitations/inv-anggi-ivan/assets', {
    method: 'POST',
    body: formData1,
  });
  assert.strictEqual(uploadMusicRes1.status, 201, 'Upload audio should return 201');
  const uploadedMusic1 = await uploadMusicRes1.json();
  console.log('  Uploaded music asset ID:', uploadedMusic1.id);
  console.log('  Uploaded music URL:', uploadedMusic1.url);
  console.log('  Uploaded music kind:', uploadedMusic1.kind);
  console.log('  Uploaded music mime:', uploadedMusic1.mimeType);
  assert.strictEqual(uploadedMusic1.kind, 'audio');
  assert.strictEqual(uploadedMusic1.mimeType, 'audio/mpeg');

  // Verify public endpoint reflects custom music
  const res2 = await app.request('/api/invitations/anggi-ivan');
  const data2 = await res2.json();
  assert.strictEqual(data2.musicUrl, `/api/assets/${uploadedMusic1.id}`, 'Public endpoint must reflect new musicUrl');
  console.log('✓ Public endpoint returns new musicUrl:', data2.musicUrl);

  // Verify asset serving
  const assetRes = await app.request(`/api/assets/${uploadedMusic1.id}`);
  assert.strictEqual(assetRes.status, 200, 'Asset endpoint should return 200');
  assert.strictEqual(assetRes.headers.get('content-type'), 'audio/mpeg');
  console.log('✓ Asset endpoint serves audio file with audio/mpeg MIME type');

  // --- 4. Upload Second Music (Lifecycle: Replace & Old File Deletion) ---
  console.log('\n--- 4. Testing Audio Replacement (Single Audio Lifecycle) ---');
  const dummyMp3Buffer2 = Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00SECOND_SONG_BUFFER_TEST_99999');
  const formData2 = new FormData();
  const file2 = new File([dummyMp3Buffer2], 'lagu-baru-revisi-2.mp3', { type: 'audio/mpeg' });
  formData2.append('file', file2);
  formData2.append('kind', 'audio');

  const uploadMusicRes2 = await app.request('/api/admin/invitations/inv-anggi-ivan/assets', {
    method: 'POST',
    body: formData2,
  });
  assert.strictEqual(uploadMusicRes2.status, 201);
  const uploadedMusic2 = await uploadMusicRes2.json();
  console.log('  Second uploaded music ID:', uploadedMusic2.id);

  // Check admin endpoint only has 1 audio asset
  const adminRes2 = await app.request('/api/admin/invitations/inv-anggi-ivan');
  const adminData2 = await adminRes2.json();
  assert.strictEqual(adminData2.invitation.musicAsset?.id, uploadedMusic2.id);
  assert.strictEqual(adminData2.invitation.musicUrl, `/api/assets/${uploadedMusic2.id}`);
  const audioAssets = adminData2.assets.filter((a) => a.kind === 'audio');
  assert.strictEqual(audioAssets.length, 1, 'Only exactly 1 audio asset should remain');
  console.log('✓ Old audio was cleaned up, exactly 1 active audio asset remains');

  // Verify old asset ID returns 404
  const oldAssetRes = await app.request(`/api/assets/${uploadedMusic1.id}`);
  assert.strictEqual(oldAssetRes.status, 404, 'Old audio asset should return 404');
  console.log('✓ Old audio file verified deleted from system');

  // --- 5. Delete Custom Music (Revert to Template Default) ---
  console.log('\n--- 5. Testing Delete Music (Revert to Template Default) ---');
  const delMusicRes = await app.request('/api/admin/invitations/inv-anggi-ivan/music', {
    method: 'DELETE',
  });
  assert.strictEqual(delMusicRes.status, 200, 'DELETE /music should return 200');

  const res3 = await app.request('/api/invitations/anggi-ivan');
  const data3 = await res3.json();
  assert.strictEqual(data3.musicUrl, null, 'musicUrl must be null after deleting custom music');
  console.log('✓ musicUrl is null -> Template falls back to default Kabagyan song');

  // --- 6. Gallery Video URL Configuration ---
  console.log('\n--- 6. Testing Gallery Video URL Configuration (PATCH & Auto-Removal) ---');
  // Set gallery video URL
  const patchVideoRes1 = await app.request('/api/admin/invitations/inv-anggi-ivan', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ galleryVideoUrl: 'https://storage.googleapis.com/test-bucket/wedding-video.mp4' }),
  });
  assert.strictEqual(patchVideoRes1.status, 200);

  const checkVideoRes1 = await app.request('/api/invitations/anggi-ivan');
  const checkVideoData1 = await checkVideoRes1.json();
  assert.strictEqual(checkVideoData1.templateFields.gallery_video_url, 'https://storage.googleapis.com/test-bucket/wedding-video.mp4');
  console.log('✓ gallery_video_url successfully set in templateFields');

  // Clear gallery video URL (client without video)
  const patchVideoRes2 = await app.request('/api/admin/invitations/inv-anggi-ivan', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ galleryVideoUrl: '' }),
  });
  assert.strictEqual(patchVideoRes2.status, 200);

  const checkVideoRes2 = await app.request('/api/invitations/anggi-ivan');
  const checkVideoData2 = await checkVideoRes2.json();
  assert.strictEqual(checkVideoData2.templateFields.gallery_video_url, undefined);
  console.log('✓ gallery_video_url cleared -> Template removes videoWidget from DOM');

  // --- 7. Gallery Photos Addition & Deletion ---
  console.log('\n--- 7. Testing Gallery Photos Management ---');
  // Upload a dummy image asset
  const dummyImg = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');
  const formImg = new FormData();
  formImg.append('file', new File([dummyImg], 'galeri-1.jpg', { type: 'image/jpeg' }));
  formImg.append('kind', 'image');
  const uploadImgRes = await app.request('/api/admin/invitations/inv-anggi-ivan/assets', {
    method: 'POST',
    body: formImg,
  });
  const uploadedImg = await uploadImgRes.json();

  // Add to gallery
  const addGalRes = await app.request('/api/admin/invitations/inv-anggi-ivan/gallery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assetId: uploadedImg.id,
      caption: 'Prewedding 1',
      sortOrder: 1,
    }),
  });
  assert.strictEqual(addGalRes.status, 201);
  const galItem = await addGalRes.json();
  console.log('  Added gallery item ID:', galItem.id);

  // Check public endpoint has gallery photo
  const galCheckPub = await app.request('/api/invitations/anggi-ivan');
  const galCheckData = await galCheckPub.json();
  assert.ok(galCheckData.gallery.some((g) => g.id === galItem.id), 'Gallery must contain newly added photo');
  console.log('✓ Public endpoint includes newly added gallery item');

  // Delete gallery item
  const delGalRes = await app.request(`/api/admin/invitations/inv-anggi-ivan/gallery/${galItem.id}`, {
    method: 'DELETE',
  });
  assert.strictEqual(delGalRes.status, 200);

  const galCheckPub2 = await app.request('/api/invitations/anggi-ivan');
  const galCheckData2 = await galCheckPub2.json();
  assert.ok(!galCheckData2.gallery.some((g) => g.id === galItem.id), 'Gallery item must be deleted');
  console.log('✓ Gallery item deleted successfully');

  // --- 8. Verify Production HTML Code Rules ---
  console.log('\n--- 8. Verifying Production HTML Syntax & Logic ---');
  const htmlPath = path.resolve(__dirname, '../apps/web/public/production/anggi-ivan/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Music hydration check
  assert.ok(html.includes('if (payload.musicUrl)'), 'Must contain payload.musicUrl check');
  assert.ok(html.includes("var songEl = document.getElementById('song')"), 'Must locate #song element');
  assert.ok(html.includes('songEl.load()'), 'Must call songEl.load() on new musicUrl');
  console.log('✓ Production HTML contains dynamic music player hydration');

  // Video conditional removal check
  assert.ok(html.includes("document.querySelector('[data-id=\"c003900\"]')"), 'Must locate video widget c003900');
  assert.ok(html.includes('videoWidget.remove()'), 'Must completely remove videoWidget from DOM when no videoUrl');
  assert.ok(html.includes('gallery_video_url'), 'Must check gallery_video_url');
  console.log('✓ Production HTML contains conditional DOM video removal');

  // Non-modification of bride/groom font size check (User handles font size)
  assert.ok(html.includes('text(\'[data-id="4b0b57e"] .elementor-heading-title\', bride.displayName)'), 'Bride name element preserved');
  assert.ok(html.includes('text(\'[data-id="08ea836"] .elementor-heading-title\', groom.displayName)'), 'Groom name element preserved');
  console.log('✓ Bride & Groom name bindings intact');

  console.log('\n======================================================');
  console.log('🎉 ALL INTEGRATION & UNIT CHECKS PASSED 100%! 🎉');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
