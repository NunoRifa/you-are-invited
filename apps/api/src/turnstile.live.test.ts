/**
 * LIVE end-to-end verification against real Cloudflare + a real running server.
 *
 * Opt-in only (skipped unless TURNSTILE_LIVE=1) so the normal suite never needs
 * network access. Uses Cloudflare's published always-pass test secret, which is
 * the documented way to exercise the real siteverify endpoint.
 *
 * Run:  TURNSTILE_LIVE=1 npm --workspace=apps/api test
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { Hono } from 'hono';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const LIVE = process.env.TURNSTILE_LIVE === '1';
const TEST_SECRET = '1x0000000000000000000000000000000AA'; // always passes
const ALWAYS_BLOCK_SECRET = '2x0000000000000000000000000000000AA'; // always fails
const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

describe.skipIf(!LIVE)('LIVE: real Cloudflare siteverify', () => {
  it('reports what the always-pass test secret returns for a dummy token', async () => {
    const body = new URLSearchParams({ secret: TEST_SECRET, response: DUMMY_TOKEN });
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = await res.json();
    // Surfaced in the report so we can state the real behaviour, not assume it.
    console.log('[LIVE] always-pass dummy response:', JSON.stringify(json));

    const blockBody = new URLSearchParams({ secret: ALWAYS_BLOCK_SECRET, response: DUMMY_TOKEN });
    const blockRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: blockBody,
    });
    console.log('[LIVE] always-block dummy response:', JSON.stringify(await blockRes.json()));

    expect(res.status).toBe(200);
  }, 20000);
});

describe.skipIf(!LIVE)('LIVE: wishes endpoint over real HTTP', () => {
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'yai-live-'));
  let server: ServerType;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = path.join(tmpDir, 'live.sqlite');
    process.env.TURNSTILE_SECRET_KEY = TEST_SECRET;
    process.env.TURNSTILE_ENABLED = 'true';

    const { wishesRouter } = await import('./routes/wishes.js');
    const { db } = await import('./db/client.js');
    const schema = await import('./db/schema.js');
    const now = Date.now();

    db.insert(schema.templates).values({ id: 'raden-motion', displayName: 'Raden Motion', isActive: true }).onConflictDoNothing().run();
    db.insert(schema.invitations).values({
      id: 'inv-live', slug: 'live-wedding', title: 'Live Wedding',
      templateKey: 'raden-motion', isPublished: true, createdAt: now, updatedAt: now,
    }).run();

    const app = new Hono();
    app.route('/api/invitations', wishesRouter);

    await new Promise<void>((resolve) => {
      server = serve({ fetch: app.fetch, port: 0 }, (info) => {
        baseUrl = `http://127.0.0.1:${(info as { port: number }).port}`;
        resolve();
      });
    });
  }, 30000);

  afterAll(() => {
    server?.close();
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* noop */ }
  });

  let n = 0;
  const post = (body: Record<string, unknown>) =>
    fetch(`${baseUrl}/api/invitations/live-wedding/wishes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `198.51.100.${(n += 1)}` },
      body: JSON.stringify(body),
    });

  it('MISSING token → 400', async () => {
    const res = await post({ guestName: 'A', message: 'bb', attendanceStatus: 'attending' });
    expect(res.status).toBe(400);
  }, 20000);

  it('DIRECT API (no token) → rejected', async () => {
    const res = await fetch(`${baseUrl}/api/invitations/live-wedding/wishes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.200' },
      body: JSON.stringify({ guestName: 'Curl', message: 'direct', attendanceStatus: 'attending' }),
    });
    expect([400, 403]).toContain(res.status);
  }, 20000);

  it('INVALID token → 403', async () => {
    const res = await post({ guestName: 'B', message: 'bb', attendanceStatus: 'attending', turnstileToken: 'clearly-not-valid' });
    expect(res.status).toBe(403);
  }, 20000);

  it('VALID dummy token → accepted (201) or action-mismatch (403), and reports which', async () => {
    const res = await post({ guestName: 'Valid Guest', message: 'Semoga bahagia selalu', attendanceStatus: 'attending', turnstileToken: DUMMY_TOKEN });
    const json = await res.json().catch(() => ({}));
    console.log('[LIVE] dummy-token submit status:', res.status, JSON.stringify(json));
    expect([201, 403]).toContain(res.status);
  }, 20000);
});
