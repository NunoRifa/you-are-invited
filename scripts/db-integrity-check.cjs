// Safe, read-only integrity probe for the local SQLite database.
const path = require('path');
const Database = require('better-sqlite3');

const target = process.argv[2] || path.resolve(__dirname, '..', 'storage', 'db', 'app.sqlite');

try {
  const db = new Database(target, { readonly: true, fileMustExist: true });
  console.log('opened:', target);
  console.log('integrity_check:', JSON.stringify(db.pragma('integrity_check')));
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => r.name);
  console.log('tables:', tables.join(', ') || '(none)');
  for (const t of ['admin_users', 'invitations', 'wishes', 'gift_accounts', 'sessions']) {
    try {
      console.log(`${t}:`, db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c);
    } catch (e) {
      console.log(`${t}: ERR ${e.message}`);
    }
  }
  db.close();
} catch (e) {
  console.log('OPEN FAILED:', e.code || '', e.message);
}
