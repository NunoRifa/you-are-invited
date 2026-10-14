import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs, { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { eq } from 'drizzle-orm';

const tempDir = mkdtempSync(path.join(tmpdir(), 'yai-audio-upload-'));
const previousCwd = process.cwd();
const previousDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = path.join(tempDir, 'test.sqlite');
process.chdir(tempDir);

let app: Hono;
let db: typeof import('../../db/client.js').db;
let sqlite: typeof import('../../db/client.js').sqlite;
let schema: typeof import('../../db/schema.js');

function upload(name: string, type: string, bytes: Uint8Array, kind = 'audio') {
  const body = new FormData();
  body.append('file', new File([bytes], name, { type }));
  body.append('kind', kind);
  return app.request('/api/admin/invitations/inv-test/assets', { method: 'POST', body });
}

function audioRows() {
  return db.select().from(schema.invitationAssets).where(eq(schema.invitationAssets.invitationId, 'inv-test')).all()
    .filter((asset) => asset.kind === 'audio');
}

beforeAll(async () => {
  schema = await import('../../db/schema.js');
  ({ db, sqlite } = await import('../../db/client.js'));
  const { adminInvitationsRouter } = await import('./invitations.js');
  const now = Date.now();
  db.insert(schema.templates).values({ id: 'raden-motion', displayName: 'Raden Motion' }).run();
  db.insert(schema.invitations).values({
    id: 'inv-test', slug: 'test', title: 'Test', templateKey: 'raden-motion',
    createdAt: now, updatedAt: now,
  }).run();
  app = new Hono();
  app.use('/api/admin/invitations/:id/assets', bodyLimit({
    maxSize: 21 * 1024 * 1024,
    onError: (c) => c.json({ error: 'Upload request exceeds the 21 MiB limit' }, 413),
  }));
  app.route('/api/admin/invitations', adminInvitationsRouter);
});

afterAll(() => {
  sqlite?.close();
  process.chdir(previousCwd);
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('admin asset uploads', () => {
  it('accepts audio and preserves previous song after invalid or oversized replacement', async () => {
    const original = await upload('old.mp3', 'audio/mpeg', Buffer.from('ID3-old-song'));
    expect(original.status).toBe(201);
    const old = await original.json() as { id: string };
    const oldPath = path.join(tempDir, 'storage/uploads/inv-test', `${old.id}.mp3`);
    expect(existsSync(oldPath)).toBe(true);

    expect((await upload('invalid.exe', 'application/octet-stream', Buffer.from('garbage'))).status).toBe(415);
    expect((await upload('fake.mp3', 'audio/mpeg', Buffer.from('garbage'))).status).toBe(415);
    expect((await upload('huge.mp3', 'audio/mpeg', Buffer.alloc(20 * 1024 * 1024 + 1))).status).toBe(413);
    expect(audioRows().map((row) => row.id)).toEqual([old.id]);
    expect(existsSync(oldPath)).toBe(true);

    const originalWrite = fs.writeFileSync;
    const writeFailure = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw new Error('disk full'); });
    try {
      expect((await upload('failed.mp3', 'audio/mpeg', Buffer.from('ID3-failed'))).status).toBe(500);
    } finally {
      writeFailure.mockRestore();
    }
    expect(audioRows().map((row) => row.id)).toEqual([old.id]);
    expect(existsSync(oldPath)).toBe(true);
    expect(fs.writeFileSync).toBe(originalWrite);

    // Test MPEG frame sync MP3 (without ID3 tag, sync word 0xFFFB) replaces safely
    const mpegSyncMp3 = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(1000)]);
    const mpegRes = await upload('raw-mpeg.mp3', 'audio/mpeg', mpegSyncMp3);
    expect(mpegRes.status).toBe(201);
    const mpegData = await mpegRes.json() as { id: string };
    expect(audioRows().map((row) => row.id)).toEqual([mpegData.id]);

    // Test MP3 sent as application/octet-stream by Windows/Linux browser replaces safely
    const octetMp3 = await upload('stream.mp3', 'application/octet-stream', Buffer.from('ID3-stream-test'));
    expect(octetMp3.status).toBe(201);
    const octetData = await octetMp3.json() as { id: string };
    expect(audioRows().map((row) => row.id)).toEqual([octetData.id]);

    const replacement = await upload('new.mp3', 'audio/mpeg', Buffer.from('ID3-new-song'));
    expect(replacement.status).toBe(201);
    const next = await replacement.json() as { id: string };
    expect(audioRows().map((row) => row.id)).toEqual([next.id]);
    expect(existsSync(oldPath)).toBe(false);
    expect(existsSync(path.join(tempDir, 'storage/uploads/inv-test', `${next.id}.mp3`))).toBe(true);
  });

  it('accepts audio near the limit, rejects larger multipart bodies, and keeps image uploads working', async () => {
    const near = await upload('near.mp3', 'audio/mpeg', Buffer.concat([
      Buffer.from('ID3'), Buffer.alloc(20 * 1024 * 1024 - 3),
    ]));
    expect(near.status).toBe(201);
    expect((await upload('over.mp3', 'audio/mpeg', Buffer.alloc(21 * 1024 * 1024))).status).toBe(413);
    expect((await upload('gallery.jpg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff]), 'image')).status).toBe(201);
  });
});
