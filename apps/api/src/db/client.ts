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

export const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

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
