const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.resolve(__dirname, '../storage/db/app.sqlite'));
const invitation = db.prepare('SELECT id FROM invitations WHERE slug = ?').get('anggi-ivan');
if (!invitation) {
  throw new Error('Invitation anggi-ivan was not found. Start the API once to seed it, then rerun this script.');
}

const update = db.transaction(() => {
  db.prepare('UPDATE invitations SET hashtag = ?, updated_at = ? WHERE id = ?')
    .run('#IvanAnggiForever', Date.now(), invitation.id);

  const bca = db.prepare('SELECT id FROM gift_accounts WHERE invitation_id = ? AND provider_name = ?')
    .get(invitation.id, 'BCA');
  if (bca) {
    db.prepare('UPDATE gift_accounts SET holder_name = ?, account_number = ?, sort_order = 1 WHERE id = ?')
      .run('Anggi Azoka Dea Prabowo', '4062284840', bca.id);
  } else {
    db.prepare('INSERT INTO gift_accounts (id, invitation_id, holder_name, account_number, provider_name, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
      .run('gf-anggi-bca', invitation.id, 'Anggi Azoka Dea Prabowo', '4062284840', 'BCA', 1);
  }

  db.prepare('DELETE FROM gift_accounts WHERE invitation_id = ? AND provider_name <> ?')
    .run(invitation.id, 'BCA');

  // Update events maps_url for anggi-ivan
  db.prepare('UPDATE events SET maps_url = ? WHERE invitation_id = ?')
    .run('https://share.google/2GHXfyXwbhgy04fGi', invitation.id);
});

update();
db.close();

require('./create-client-invitation.cjs');
