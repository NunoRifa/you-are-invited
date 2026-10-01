const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve('storage/db/app.sqlite');
const db = new Database(dbPath, { readonly: true });

console.log('=== INVITATIONS ===');
const invs = db.prepare('SELECT id, slug, title FROM invitations').all();
console.log(JSON.stringify(invs, null, 2));

console.log('\n=== WISHES IN DB ===');
const wishes = db.prepare("SELECT id, invitation_id, guest_name, attendance_status, message, is_hidden, datetime(created_at/1000, 'unixepoch', 'localtime') as created_at_local FROM wishes ORDER BY created_at DESC").all();
console.log(JSON.stringify(wishes, null, 2));

console.log('\n=== STATS ===');
const stats = db.prepare(`
  SELECT
    invitation_id,
    COUNT(*) as total,
    SUM(CASE WHEN attendance_status = 'attending' THEN 1 ELSE 0 END) as attending,
    SUM(CASE WHEN attendance_status = 'not_attending' THEN 1 ELSE 0 END) as not_attending,
    SUM(CASE WHEN attendance_status = 'maybe' THEN 1 ELSE 0 END) as maybe,
    SUM(CASE WHEN is_hidden = 1 THEN 1 ELSE 0 END) as hidden_count
  FROM wishes
  GROUP BY invitation_id
`).all();
console.log(JSON.stringify(stats, null, 2));
