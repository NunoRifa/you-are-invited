import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';

const temp = mkdtempSync(path.join(os.tmpdir(), 'yai-asset-range-'));
const previousDatabase = process.env.DATABASE_URL;
process.env.DATABASE_URL = path.join(temp, 'test.sqlite');
let app: Hono;
let sqlite: typeof import('../db/client.js').sqlite;
beforeAll(async () => {
  const client = await import('../db/client.js');
  sqlite = client.sqlite;
  const schema = await import('../db/schema.js');
  const { assetsRouter } = await import('./assets.js');
  const now = Date.now();
  client.db.insert(schema.templates).values({ id: 'range-template', displayName: 'Range template' }).run();
  client.db.insert(schema.invitations).values({ id: 'range-inv', slug: 'range-inv', title: 'Range', templateKey: 'range-template', isPublished: true, createdAt: now, updatedAt: now }).run();
  writeFileSync(path.join(temp, 'audio.mp3'), Buffer.from('0123456789'));
  client.db.insert(schema.invitationAssets).values({ id: 'range-audio', invitationId: 'range-inv', kind: 'audio', storagePath: path.join(temp, 'audio.mp3'), mimeType: 'audio/mpeg', originalFilename: 'audio.mp3', createdAt: now }).run();
  app = new Hono(); app.route('/api/assets', assetsRouter);
});
afterAll(() => {
  sqlite?.close();
  if (previousDatabase === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDatabase;
  rmSync(temp, { recursive: true, force: true });
});
describe('media seeking byte ranges', () => {
  it('serves the requested bytes and advertises seekable audio', async () => {
    const response = await app.request('/api/assets/range-audio', { headers: { Range: 'bytes=4-7' } });
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 4-7/10');
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(response.headers.get('Content-Length')).toBe('4');
    expect(await response.text()).toBe('4567');
  });
  it('supports suffix ranges and rejects unsatisfiable ranges', async () => {
    const suffix = await app.request('/api/assets/range-audio', { headers: { Range: 'bytes=-3' } });
    expect(suffix.status).toBe(206);
    expect(await suffix.text()).toBe('789');
    const invalid = await app.request('/api/assets/range-audio', { headers: { Range: 'bytes=12-' } });
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get('Content-Range')).toBe('bytes */10');
  });
});
