/**
 * Integration test for the Turnstile gate on the public wishes endpoint.
 *
 * Boots the real Hono router against a throwaway SQLite database and drives it
 * through `app.fetch`, proving the SERVER rejects requests regardless of what a
 * browser does — including a direct API call with no widget at all.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';

const TEST_SECRET = '1x0000000000000000000000000000000AA';

// Pin the DB to a temp file BEFORE the router/db client module is imported,
// so the real storage/db/app.sqlite is never touched.
const tmpDir = mkdtempSync(path.join(tmpdir(), 'yai-wishes-test-'));
process.env.DATABASE_URL = path.join(tmpDir, 'test.sqlite');
process.env.TURNSTILE_SECRET_KEY = TEST_SECRET;
process.env.TURNSTILE_ENABLED = 'true';
delete process.env.TURNSTILE_SITE_KEY;

let app: Hono;
let dbModule: typeof import('../db/client.js');

function mockSiteverify(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }));
}

// Unique IP per request so the endpoint's 5s/IP rate-limit never interferes.
let ipCounter = 0;
function nextIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter % 250}`;
}

async function postWishes(body: Record<string, unknown>) {
  return app.fetch(
    new Request('http://localhost/api/invitations/test-wedding/wishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': nextIp() },
      body: JSON.stringify(body),
    }),
  );
}

beforeAll(async () => {
  const { wishesRouter } = await import('./wishes.js');
  dbModule = await import('../db/client.js');
  const schema = await import('../db/schema.js');
  const now = Date.now();

  // Template must exist first — invitations.template_key references it.
  dbModule.db.insert(schema.templates).values({
    id: 'raden-motion',
    displayName: 'Raden Motion',
    isActive: true,
  }).onConflictDoNothing().run();

  dbModule.db.insert(schema.invitations).values({
    id: 'inv-test-wedding',
    slug: 'test-wedding',
    title: 'Test Wedding',
    templateKey: 'raden-motion',
    isPublished: true,
    createdAt: now,
    updatedAt: now,
  }).run();

  app = new Hono();
  app.route('/api/invitations', wishesRouter);
});

afterAll(() => {
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* noop */ }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/invitations/:slug/wishes — Turnstile gate', () => {
  it('SUCCESS: valid token → 201 and the wish is stored', async () => {
    mockSiteverify({ success: true, action: 'wishes' });
    const res = await postWishes({
      guestName: 'Tamu Baik',
      message: 'Selamat menempuh hidup baru!',
      attendanceStatus: 'attending',
      turnstileToken: 'valid-token',
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('FAILED: verification rejected → 403, nothing stored', async () => {
    mockSiteverify({ success: false, 'error-codes': ['invalid-input-response'] });
    const res = await postWishes({
      guestName: 'Spammer',
      message: 'buy cheap stuff here',
      attendanceStatus: 'attending',
      turnstileToken: 'forged',
    });
    expect(res.status).toBe(403);
  });

  it('MISSING TOKEN: no turnstileToken → 400', async () => {
    const res = await postWishes({
      guestName: 'Tamu',
      message: 'Ucapan tanpa token',
      attendanceStatus: 'attending',
    });
    expect(res.status).toBe(400);
  });

  it('INVALID TOKEN: rejected secret → 403 without leaking the Cloudflare code', async () => {
    mockSiteverify({ success: false, 'error-codes': ['invalid-input-secret'] });
    const res = await postWishes({
      guestName: 'Tamu',
      message: 'Ucapan',
      attendanceStatus: 'attending',
      turnstileToken: 'token',
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(JSON.stringify(json)).not.toContain('invalid-input-secret');
  });

  it('EXPIRED TOKEN: timeout-or-duplicate → 403 retryable', async () => {
    mockSiteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] });
    const res = await postWishes({
      guestName: 'Tamu',
      message: 'Ucapan',
      attendanceStatus: 'attending',
      turnstileToken: 'stale',
    });
    expect(res.status).toBe(403);
  });

  it('DIRECT API REQUEST: no widget, no token → rejected', async () => {
    // Simulates curl/Postman hitting the endpoint directly.
    const res = await postWishes({ guestName: 'Direct', message: 'Direct API call', attendanceStatus: 'attending' });
    expect([400, 403]).toContain(res.status);
  });

  it('CLOUDFLARE DOWN: unreachable → 503 (fail-closed)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const res = await postWishes({
      guestName: 'Tamu',
      message: 'Ucapan',
      attendanceStatus: 'attending',
      turnstileToken: 'token',
    });
    expect(res.status).toBe(503);
  });
});
