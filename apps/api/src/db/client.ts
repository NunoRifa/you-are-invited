import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Determine root storage directory
let dbPath = process.env.DATABASE_URL;
if (!dbPath || dbPath.startsWith('postgres:') || dbPath.startsWith('mysql:')) {
  dbPath = path.resolve(process.cwd(), 'storage/db/app.sqlite');
  if (!fs.existsSync(path.dirname(dbPath)) && fs.existsSync(path.resolve(process.cwd(), '../../storage/db'))) {
    dbPath = path.resolve(process.cwd(), '../../storage/db/app.sqlite');
  }
} else {
  dbPath = path.resolve(process.cwd(), dbPath);
}

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// --- Pre-flight check on an existing database file -------------------------
// Evidence-based guard. A truncated / partially-copied database still carries a
// header that DECLARES more pages than the file actually contains; SQLite then
// fails the WAL pragma with
//   SqliteError: database disk image is malformed  (SQLITE_CORRUPT)
// and the container crash-loops on an opaque error.
//
// This function only REPORTS. It never deletes or rewrites a database that may
// still hold recoverable data.
export function describeDatabaseSanity(target: string): string | null {
  if (!fs.existsSync(target)) return null; // Fresh deploy — will be created.
  const { size } = fs.statSync(target);
  if (size === 0) {
    return 'the database file exists but is 0 bytes (an incomplete copy or interrupted write)';
  }

  // Read the 100-byte SQLite header.
  let header: Buffer;
  try {
    const fd = fs.openSync(target, 'r');
    header = Buffer.alloc(100);
    const read = fs.readSync(fd, header, 0, 100, 0);
    fs.closeSync(fd);
    if (read < 100) return 'the database file is smaller than a SQLite header (100 bytes) — it is truncated';
  } catch {
    return null; // Unreadable — let better-sqlite3 produce the real error.
  }

  if (header.toString('utf8', 0, 15) !== 'SQLite format 3') {
    return 'the file does not start with the SQLite header ("SQLite format 3") — it is not a SQLite database';
  }

  // Page size lives at bytes 16-17 (big-endian); the value 1 means 65536.
  const rawPageSize = header.readUInt16BE(16);
  const pageSize = rawPageSize === 1 ? 65536 : rawPageSize;
  if (pageSize < 512 || (pageSize & (pageSize - 1)) !== 0) {
    return `the header declares an invalid page size (${rawPageSize})`;
  }

  const actualPages = size / pageSize;
  if (!Number.isInteger(actualPages)) {
    return `the database file size (${size} bytes) is not a whole number of ${pageSize}-byte pages — it is truncated or partially copied`;
  }

  // Page count lives at bytes 28-31 (big-endian). In WAL mode the main file's
  // value is a checkpoint-boundary lower bound, so a file may legitimately hold
  // MORE pages than declared — but never fewer.
  const declaredPages = header.readUInt32BE(28);
  if (declaredPages > actualPages) {
    return `the header declares ${declaredPages} pages but the file contains only ${actualPages} — it is truncated (the proven cause of "database disk image is malformed")`;
  }

  return null;
}

function openDatabase(target: string): Database.Database {
  const sanityIssue = describeDatabaseSanity(target);
  if (sanityIssue) {
    console.error(`[db] FATAL: refusing to open the SQLite database at ${target}.`);
    console.error(`[db] Reason: ${sanityIssue}.`);
    console.error('[db] A malformed database must NOT be deleted if it may hold data.');
    console.error(`[db] 1) Back it up:  cp "${target}" "${target}.bak"`);
    console.error(`[db] 2) Inspect safely (read-only):  node scripts/db-integrity-check.cjs "${target}"`);
    console.error('[db] 3) If it is a bad copy, restore a known-good backup.');
    console.error('[db] 4) Only if the data is expendable: remove the file so a fresh one is created.');
    process.exit(1);
  }

  try {
    const database = new Database(target);
    database.pragma('journal_mode = WAL');
    database.pragma('foreign_keys = ON');
    return database;
  } catch (error) {
    const code = (error as { code?: string }).code;
    console.error(`[db] FATAL: cannot open SQLite database at ${target}${code ? ` (${code})` : ''}`);
    if (code === 'SQLITE_CORRUPT' || code === 'SQLITE_NOTADB') {
      console.error('[db] The file did not pass SQLite validation. Back it up and inspect');
      console.error(`[db] read-only before acting:  node scripts/db-integrity-check.cjs "${target}"`);
    }
    process.exit(1);
  }
}

export const sqlite = openDatabase(dbPath);

// Initialize tables if they do not exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    preview_image_path TEXT,
    supports_pantun INTEGER NOT NULL DEFAULT 0,
    supports_hero_video INTEGER NOT NULL DEFAULT 0,
    quote_block_position TEXT NOT NULL DEFAULT 'none',
    gallery_video_type TEXT NOT NULL DEFAULT 'none',
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    owner_user_id TEXT REFERENCES admin_users(id),
    title TEXT NOT NULL,
    template_key TEXT NOT NULL REFERENCES templates(id),
    opening_greeting_text TEXT,
    closing_text TEXT,
    quote_text TEXT,
    quote_source TEXT,
    cover_guest_label_default TEXT NOT NULL DEFAULT 'Tamu Undangan',
    hashtag TEXT,
    theme TEXT,
    couple_display_name TEXT,
    cover_photo_asset_id TEXT REFERENCES invitation_assets(id),
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invitation_template_fields (
    id TEXT PRIMARY KEY,
    invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    field_value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invitation_assets (
    id TEXT PRIMARY KEY,
    invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS couples (
    id TEXT PRIMARY KEY,
    invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    full_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    father_name TEXT,
    mother_name TEXT,
    birth_order_label TEXT,
    instagram_handle TEXT,
    photo_asset_id TEXT REFERENCES invitation_assets(id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time_label TEXT,
    venue_name TEXT NOT NULL,
    venue_address TEXT NOT NULL,
    maps_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS gallery_images (
    id TEXT PRIMARY KEY,
    invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL REFERENCES invitation_assets(id),
    caption TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS story_items (
    id TEXT PRIMARY KEY,
    invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS wishes (
    id TEXT PRIMARY KEY,
    invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    guest_name TEXT NOT NULL,
    attendance_status TEXT NOT NULL DEFAULT 'attending',
    message TEXT NOT NULL,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gift_accounts (
    id TEXT PRIMARY KEY,
    invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    holder_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS livestream_info (
    id TEXT PRIMARY KEY,
    invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    date TEXT NOT NULL,
    time_label TEXT NOT NULL,
    stream_url TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_invitations_slug ON invitations(slug);
  CREATE INDEX IF NOT EXISTS idx_wishes_inv_created ON wishes(invitation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_events_inv_sort ON events(invitation_id, sort_order);
`);

// Run non-destructive column migrations for existing SQLite databases
try {
  const invCols = sqlite.prepare("PRAGMA table_info(invitations)").all() as { name: string }[];
  if (!invCols.some((c) => c.name === 'couple_display_name')) {
    sqlite.exec('ALTER TABLE invitations ADD COLUMN couple_display_name TEXT;');
  }
  if (!invCols.some((c) => c.name === 'cover_photo_asset_id')) {
    sqlite.exec('ALTER TABLE invitations ADD COLUMN cover_photo_asset_id TEXT REFERENCES invitation_assets(id);');
  }
} catch (e) {
  console.error('Migration warning for invitations:', e);
}

export const db = drizzle(sqlite, { schema });
