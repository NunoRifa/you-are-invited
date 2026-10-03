const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.resolve('storage/db/app.sqlite'));
console.log('Invitations:', db.prepare('SELECT id, slug, title FROM invitations').all());
console.log('Couples:', db.prepare('SELECT id, invitation_id, role, full_name, display_name FROM couples WHERE invitation_id = "inv-anggi-ivan"').all());
console.log('Events:', db.prepare('SELECT id, invitation_id, label, date, venue_name, maps_url FROM events WHERE invitation_id = "inv-anggi-ivan"').all());
