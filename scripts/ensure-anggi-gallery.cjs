const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.resolve(__dirname, '../storage/db/app.sqlite');
const db = new Database(dbPath);

const invId = 'inv-anggi-ivan';

// 1. Sync files between storage/uploads and apps/api/storage/uploads
const dir1 = path.resolve(__dirname, `../storage/uploads/${invId}`);
const dir2 = path.resolve(__dirname, `../apps/api/storage/uploads/${invId}`);
if (!fs.existsSync(dir1)) fs.mkdirSync(dir1, { recursive: true });
if (!fs.existsSync(dir2)) fs.mkdirSync(dir2, { recursive: true });

function syncDirs(src, dest) {
  if (fs.existsSync(src)) {
    for (const f of fs.readdirSync(src)) {
      const srcFile = path.join(src, f);
      const destFile = path.join(dest, f);
      if (fs.statSync(srcFile).isFile() && !fs.existsSync(destFile)) {
        fs.copyFileSync(srcFile, destFile);
        console.log(`Synced: ${f} -> ${dest}`);
      }
    }
  }
}
syncDirs(dir2, dir1);
syncDirs(dir1, dir2);

// 2. Check assets and gallery_images
const assets = db.prepare('SELECT * FROM invitation_assets WHERE invitation_id = ?').all(invId);
console.log(`Total invitation_assets for ${invId}: ${assets.length}`);
assets.forEach(a => console.log(`  - [${a.kind}] ${a.id} (${a.original_filename})`));

const gallery = db.prepare('SELECT * FROM gallery_images WHERE invitation_id = ?').all(invId);
console.log(`\nCurrent gallery_images for ${invId}: ${gallery.length}`);
gallery.forEach(g => console.log(`  - gallery id: ${g.id}, assetId: ${g.asset_id}, caption: ${g.caption}`));

// 3. Find any image assets that are NOT yet in gallery_images and NOT cover/hero/bride/groom/closing
const nonGalleryIds = new Set([
  'ast-anggi-ivan-cover',
  'ast-anggi-ivan-hero',
  'ast-anggi-ivan-bride',
  'ast-anggi-ivan-groom',
  'ast-anggi-ivan-closing'
]);

// Also check invitations coverPhotoAssetId and couples photoAssetId
const inv = db.prepare('SELECT * FROM invitations WHERE id = ?').get(invId);
if (inv.cover_photo_asset_id) nonGalleryIds.add(inv.cover_photo_asset_id);
const couples = db.prepare('SELECT * FROM couples WHERE invitation_id = ?').all(invId);
couples.forEach(c => { if (c.photo_asset_id) nonGalleryIds.add(c.photo_asset_id); });
const templateFields = db.prepare('SELECT * FROM invitation_template_fields WHERE invitation_id = ?').all(invId);
templateFields.forEach(tf => {
  if (tf.field_key === 'hero_photo_asset_id' || tf.field_key === 'closing_photo_asset_id') {
    nonGalleryIds.add(tf.field_value);
  }
});

const existingGalleryAssetIds = new Set(gallery.map(g => g.asset_id));

const candidateImages = assets.filter(a =>
  a.kind === 'image' &&
  !nonGalleryIds.has(a.id) &&
  !existingGalleryAssetIds.has(a.id)
);

console.log(`\nFound ${candidateImages.length} unlinked candidate gallery image assets:`);
let nextOrder = gallery.length + 1;
for (const cand of candidateImages) {
  const gId = `gal-${cand.id.replace(/^ast-/, '')}`;
  const caption = (cand.original_filename || 'Galeri').replace(/\.[^/.]+$/, '');
  db.prepare(`
    INSERT INTO gallery_images (id, invitation_id, asset_id, caption, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(gId, invId, cand.id, caption, nextOrder++);
  console.log(`  + Linked asset ${cand.id} to gallery as ${gId} (caption: "${caption}", order: ${nextOrder - 1})`);
}

const finalGallery = db.prepare('SELECT * FROM gallery_images WHERE invitation_id = ? ORDER BY sort_order').all(invId);
console.log(`\nFinal gallery_images count: ${finalGallery.length}`);
finalGallery.forEach((g, i) => console.log(`  ${i + 1}. [${g.id}] asset: ${g.asset_id} - ${g.caption}`));

db.close();
console.log('\n[DONE] Database gallery sync complete.');
