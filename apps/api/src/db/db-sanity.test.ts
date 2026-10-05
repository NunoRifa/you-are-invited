/**
 * Regression test for the `SQLITE_CORRUPT: database disk image is malformed`
 * crash-loop.
 *
 * PROVEN trigger (see the fixture enumeration this replaces): a truncated or
 * partially-copied main database file. Orphaned WAL/SHM sidecars alone do NOT
 * cause it — that hypothesis was tested and rejected.
 *
 * These tests assert the guard (a) correctly detects the malformed file and
 * (b) leaves a healthy database alone.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describeDatabaseSanity } from './client.js';

const REAL_DB_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'storage', 'db');
const REAL_DB = path.join(REAL_DB_DIR, 'app.sqlite');

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
  }
});

function newDbDir(): string {
  const tmp = mkdtempSync(path.join(tmpdir(), 'yai-db-'));
  made.push(tmp);
  const dbDir = path.join(tmp, 'db');
  mkdirSync(dbDir, { recursive: true });
  return dbDir;
}

describe('database sanity guard', () => {
  it('CONFIRMS the crash exists, then detects the truncated file', () => {
    const dbDir = newDbDir();
    const target = path.join(dbDir, 'app.sqlite');

    // Build a valid database, then truncate it to simulate a partial copy.
    const seed = new Database(target);
    seed.pragma('journal_mode = WAL');
    seed.exec('CREATE TABLE t (id INTEGER PRIMARY KEY); INSERT INTO t VALUES (1),(2),(3);');
    seed.close();

    const full = readFileSync(target);
    writeFileSync(target, full.subarray(0, Math.floor(full.length / 2)));

    // Step 1 — better-sqlite3 throws the exact error from the logs.
    expect(() => {
      const broken = new Database(target);
      broken.pragma('journal_mode = WAL');
    }).toThrow(/malformed|SQLITE_CORRUPT/i);

    // Step 2 — our guard detects it before the opaque crash, with a reason.
    const reason = describeDatabaseSanity(target);
    expect(reason).toBeTruthy();
    expect(reason).toMatch(/truncated|pages|0 bytes|SQLite header/i);
  });

  it('accepts a healthy database and creates none for a fresh path', () => {
    const dbDir = newDbDir();
    const target = path.join(dbDir, 'app.sqlite');

    // Fresh path — nothing to inspect.
    expect(describeDatabaseSanity(target)).toBeNull();

    if (existsSync(REAL_DB)) {
      copyFileSync(REAL_DB, target);
    } else {
      const seed = new Database(target);
      seed.exec('CREATE TABLE t (id INTEGER PRIMARY KEY);');
      seed.close();
    }
    expect(describeDatabaseSanity(target)).toBeNull();

    // And it really is openable + intact.
    const db = new Database(target, { readonly: true });
    expect(db.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }]);
    db.close();
  });

  it('flags a 0-byte file', () => {
    const dbDir = newDbDir();
    const target = path.join(dbDir, 'app.sqlite');
    writeFileSync(target, Buffer.alloc(0));
    expect(describeDatabaseSanity(target)).toMatch(/0 bytes/);
  });

  it('flags a non-SQLite file of page-aligned size', () => {
    const dbDir = newDbDir();
    const target = path.join(dbDir, 'app.sqlite');
    writeFileSync(target, Buffer.alloc(4096, 0x41)); // 4096 'A' bytes
    expect(describeDatabaseSanity(target)).toMatch(/SQLite header/);
  });
});
