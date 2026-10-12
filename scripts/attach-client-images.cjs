const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.resolve(__dirname, '../storage/db/app.sqlite');
const db = new Database(dbPath);

const invitation = db.prepare('SELECT id FROM invitations WHERE slug = ?').get('anggi-ivan');
if (!invitation) {
  throw new Error('Invitation anggi-ivan was not found in db.');
}

const invId = invitation.id;

const mediaFiles = {
  cover: {
    src: 'C:/Users/SCI-pc/.gemini/antigravity/brain/34d7a2d3-b238-44cd-8d71-44d6864b88fc/.user_uploaded/media_1791815644751_0343a4de.png',
    id: 'ast-anggi-ivan-cover',
    filename: 'Anggi-Ivan-Cover.png'
  },
  hero: {
    src: 'C:/Users/SCI-pc/.gemini/antigravity/brain/34d7a2d3-b238-44cd-8d71-44d6864b88fc/.user_uploaded/media_1791815652976_2e94fb2b.png',
    id: 'ast-anggi-ivan-hero',
    filename: 'Anggi-Ivan-Hero.png'
  },
  bride: {
    src: 'C:/Users/SCI-pc/.gemini/antigravity/brain/34d7a2d3-b238-44cd-8d71-44d6864b88fc/.user_uploaded/media_1791815659579_e299a4e5.png',
    id: 'ast-anggi-ivan-bride',
    filename: 'Anggi-Bride.png'
  },
  groom: {
    src: 'C:/Users/SCI-pc/.gemini/antigravity/brain/34d7a2d3-b238-44cd-8d71-44d6864b88fc/.user_uploaded/media_1791815665466_ca5fddd1.png',
    id: 'ast-anggi-ivan-groom',
    filename: 'Ivan-Groom.png'
  },
  closing: {
    src: 'C:/Users/SCI-pc/.gemini/antigravity/brain/34d7a2d3-b238-44cd-8d71-44d6864b88fc/.user_uploaded/media_1791815671828_cca8a4cc.png',
    id: 'ast-anggi-ivan-closing',
    filename: 'Anggi-Ivan-Closing.png'
  }
};

// Destination directories
const dirs = [
  path.resolve(__dirname, `../storage/uploads/${invId}`),
  path.resolve(__dirname, `../apps/api/storage/uploads/${invId}`)
];

dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

const now = Date.now();

for (const [key, item] of Object.entries(mediaFiles)) {
  const destName = `${item.id}.png`;
  const relativePath = `storage/uploads/${invId}/${destName}`;

  dirs.forEach(d => {
    fs.copyFileSync(item.src, path.join(d, destName));
  });

  // Upsert into invitation_assets
  const existingAsset = db.prepare('SELECT id FROM invitation_assets WHERE id = ?').get(item.id);
  if (!existingAsset) {
    db.prepare(`
      INSERT INTO invitation_assets (id, invitation_id, kind, storage_path, mime_type, original_filename, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, invId, 'image', relativePath, 'image/png', item.filename, now);
  } else {
    db.prepare(`
      UPDATE invitation_assets SET storage_path = ?, original_filename = ? WHERE id = ?
    `).run(relativePath, item.filename, item.id);
  }
}

// 1. Cover
db.prepare('UPDATE invitations SET cover_photo_asset_id = ?, updated_at = ? WHERE id = ?')
  .run(mediaFiles.cover.id, now, invId);

// 2. Hero in invitation_template_fields
const existingHero = db.prepare('SELECT id FROM invitation_template_fields WHERE invitation_id = ? AND field_key = ?')
  .get(invId, 'hero_photo_asset_id');
if (existingHero) {
  db.prepare('UPDATE invitation_template_fields SET field_value = ? WHERE id = ?')
    .run(mediaFiles.hero.id, existingHero.id);
} else {
  db.prepare('INSERT INTO invitation_template_fields (id, invitation_id, field_key, field_value) VALUES (?, ?, ?, ?)')
    .run(`tf-hero-${now}`, invId, 'hero_photo_asset_id', mediaFiles.hero.id);
}

// 3. Bride photo
db.prepare('UPDATE couples SET photo_asset_id = ? WHERE invitation_id = ? AND role = ?')
  .run(mediaFiles.bride.id, invId, 'bride');

// 4. Groom photo
db.prepare('UPDATE couples SET photo_asset_id = ? WHERE invitation_id = ? AND role = ?')
  .run(mediaFiles.groom.id, invId, 'groom');

// 5. Closing in invitation_template_fields
const existingClosing = db.prepare('SELECT id FROM invitation_template_fields WHERE invitation_id = ? AND field_key = ?')
  .get(invId, 'closing_photo_asset_id');
if (existingClosing) {
  db.prepare('UPDATE invitation_template_fields SET field_value = ? WHERE id = ?')
    .run(mediaFiles.closing.id, existingClosing.id);
} else {
  db.prepare('INSERT INTO invitation_template_fields (id, invitation_id, field_key, field_value) VALUES (?, ?, ?, ?)')
    .run(`tf-closing-${now}`, invId, 'closing_photo_asset_id', mediaFiles.closing.id);
}

console.log('[SUCCESS] All 5 photos successfully attached to anggi-ivan in database!');
db.close();

