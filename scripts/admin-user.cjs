const { randomBytes, scryptSync } = require('node:crypto');
const Database = require('better-sqlite3');
const path = require('node:path');
const readline = require('node:readline');

const dbPath = process.env.DATABASE_URL && !/^(postgres|mysql):/.test(process.env.DATABASE_URL)
  ? path.resolve(process.cwd(), process.env.DATABASE_URL)
  : path.resolve(__dirname, '../storage/db/app.sqlite');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(label) {
  return new Promise((resolve) => rl.question(label, resolve));
}

function hidden(label) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      rl.question(label, resolve);
      return;
    }
    let value = '';
    const wasRaw = stdin.isRaw;
    process.stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    const onData = (chunk) => {
      const key = chunk.toString();
      if (key === '\u0003') process.exit(130);
      if (key === '\r' || key === '\n') {
        stdin.off('data', onData);
        stdin.setRawMode(Boolean(wasRaw));
        process.stdout.write('\n');
        resolve(value);
      } else if (key === '\u007f' || key === '\b') {
        value = value.slice(0, -1);
      } else if (key >= ' ') {
        value += key;
      }
    };
    stdin.on('data', onData);
  });
}

(async () => {
  try {
    const email = (await ask('Operator email: ')).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email tidak valid.');
    const password = await hidden('Password (minimal 12 karakter): ');
    if (password.length < 12) throw new Error('Password harus minimal 12 karakter.');
    const confirmation = await hidden('Konfirmasi password: ');
    if (password !== confirmation) throw new Error('Konfirmasi password tidak cocok.');

    const db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    db.exec(`CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner', created_at INTEGER NOT NULL
    )`);
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    const passwordHash = `scrypt:${salt}:${hash}`;
    const existing = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(email);
    if (existing) {
      db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(passwordHash, existing.id);
      console.log(`Operator ${email} diperbarui.`);
    } else {
      db.prepare('INSERT INTO admin_users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(`admin-${randomBytes(16).toString('hex')}`, email, passwordHash, 'super_admin', Date.now());
      console.log(`Operator ${email} dibuat.`);
    }
    db.close();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Gagal membuat operator.');
    process.exitCode = 1;
  } finally {
    rl.close();
  }
})();
