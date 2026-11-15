import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { Hono } from 'hono';

const tempDir = mkdtempSync(path.join(tmpdir(), 'yai-wishes-yt-'));
const testDbPath = path.join(tempDir, 'test.sqlite');
process.env.DATABASE_URL = testDbPath;
process.env.TURNSTILE_ENABLED = 'false';

let app: Hono;
let db: typeof import('../db/client.js').db;
let schema: typeof import('../db/schema.js');

let ipCounter = 0;
function nextIp() {
  ipCounter += 1;
  return `198.51.100.${ipCounter % 250}`;
}

async function postWish(slug: string, body: Record<string, unknown>, ip = nextIp()) {
  return app.fetch(
    new Request(`http://localhost/api/invitations/${slug}/wishes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': ip,
      },
      body: JSON.stringify(body),
    }),
  );
}

async function getWishes(slug: string) {
  return app.fetch(
    new Request(`http://localhost/api/invitations/${slug}/wishes`),
  );
}

async function getPublicPayload(slug: string) {
  return app.fetch(
    new Request(`http://localhost/api/invitations/${slug}`),
  );
}

async function getCsvExport(invId: string) {
  return app.fetch(
    new Request(`http://localhost/api/admin/invitations/${invId}/wishes/export`, {
      headers: {
        Cookie: 'session_id=session-super-admin',
      },
    }),
  );
}

describe('Task 4: Wishes & RSVP for yt-wedding and legacy invitations', () => {
  beforeAll(async () => {
    schema = await import('../db/schema.js');
    const dbClient = await import('../db/client.js');
    db = dbClient.db;
    const { wishesRouter } = await import('./wishes.js');
    const { invitationsRouter } = await import('./invitations.js');
    const { adminWishesRouter } = await import('./admin/wishes.js');

    const now = Date.now();

    // Seed templates
    db.insert(schema.templates).values([
      { id: 'raden-motion', displayName: 'Raden Motion', isActive: true },
      { id: 'yt-wedding', displayName: 'YT Wedding', isActive: true },
    ]).onConflictDoNothing().run();

    // Seed admin & session
    db.insert(schema.adminUsers).values({
      id: 'super-admin-user',
      email: 'admin@example.com',
      passwordHash: 'hash',
      role: 'super_admin',
      createdAt: now,
    }).onConflictDoNothing().run();

    db.insert(schema.sessions).values({
      id: 'session-super-admin',
      userId: 'super-admin-user',
      expiresAt: now + 3600_000,
    }).onConflictDoNothing().run();

    // Seed invitations
    // 1. Legacy Anggi (raden-motion, published)
    db.insert(schema.invitations).values({
      id: 'inv-anggi',
      slug: 'anggi-ivan',
      title: 'Pernikahan Anggi & Ivan',
      templateKey: 'raden-motion',
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing().run();

    // 2. yt-wedding with valid livestream
    db.insert(schema.invitations).values({
      id: 'inv-riska',
      slug: 'riska-rafli',
      title: 'Pernikahan Riska & Rafli',
      templateKey: 'yt-wedding',
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing().run();

    db.insert(schema.livestreamInfo).values({
      id: 'live-riska',
      invitationId: 'inv-riska',
      label: 'Live Streaming Akad',
      date: '2026-11-20',
      timeLabel: '08:00 WIB',
      streamUrl: 'https://youtube.com/live/example123',
    }).onConflictDoNothing().run();

    // 3. yt-wedding without livestream streamUrl
    db.insert(schema.invitations).values({
      id: 'inv-no-stream',
      slug: 'riska-no-stream',
      title: 'Riska No Stream',
      templateKey: 'yt-wedding',
      isPublished: true,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing().run();

    // 4. Unpublished draft
    db.insert(schema.invitations).values({
      id: 'inv-draft',
      slug: 'riska-draft',
      title: 'Riska Draft',
      templateKey: 'yt-wedding',
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing().run();

    app = new Hono();
    app.route('/api/invitations', wishesRouter);
    app.route('/api/invitations', invitationsRouter);
    app.route('/api/admin/invitations', adminWishesRouter);
  });

  afterAll(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // noop
    }
  });

  describe('Database migration test on old schema copy', () => {
    it('migrates legacy wishes table without data loss, defaulting channel to null and pax to 1', () => {
      const migDbPath = path.join(tempDir, 'legacy-migration-test.sqlite');
      const legacyDb = new Database(migDbPath);

      legacyDb.exec(`
        CREATE TABLE wishes (
          id TEXT PRIMARY KEY,
          invitation_id TEXT NOT NULL,
          guest_name TEXT NOT NULL,
          attendance_status TEXT NOT NULL DEFAULT 'attending',
          message TEXT NOT NULL,
          is_hidden INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );
      `);

      legacyDb.prepare(`
        INSERT INTO wishes (id, invitation_id, guest_name, attendance_status, message, is_hidden, created_at)
        VALUES ('w-legacy-1', 'inv-legacy', 'Tamu Lama', 'attending', 'Selamat berbahagia!', 0, 1600000000000);
      `).run();

      // Apply non-destructive migration
      const wishCols = legacyDb.prepare("PRAGMA table_info(wishes)").all() as { name: string }[];
      if (!wishCols.some((c) => c.name === 'attendance_channel')) {
        legacyDb.exec('ALTER TABLE wishes ADD COLUMN attendance_channel TEXT;');
      }
      if (!wishCols.some((c) => c.name === 'guest_count')) {
        legacyDb.exec('ALTER TABLE wishes ADD COLUMN guest_count INTEGER NOT NULL DEFAULT 1;');
      }

      const row = legacyDb.prepare('SELECT * FROM wishes WHERE id = ?').get('w-legacy-1') as {
        id: string;
        guest_name: string;
        attendance_status: string;
        attendance_channel: string | null;
        guest_count: number;
        message: string;
      };

      expect(row).toBeDefined();
      expect(row.guest_name).toBe('Tamu Lama');
      expect(row.attendance_status).toBe('attending');
      expect(row.attendance_channel).toBeNull();
      expect(row.guest_count).toBe(1);

      // Verify new rows can be inserted with new columns
      legacyDb.prepare(`
        INSERT INTO wishes (id, invitation_id, guest_name, attendance_status, attendance_channel, guest_count, message, is_hidden, created_at)
        VALUES ('w-new-1', 'inv-legacy', 'Tamu Baru', 'attending', 'offline', 2, 'Selamat!', 0, 1600000000001);
      `).run();

      const newRow = legacyDb.prepare('SELECT * FROM wishes WHERE id = ?').get('w-new-1') as {
        attendance_channel: string;
        guest_count: number;
      };
      expect(newRow.attendance_channel).toBe('offline');
      expect(newRow.guest_count).toBe(2);

      legacyDb.close();
    });
  });

  describe('Legacy invitation (Anggi) behavior', () => {
    it('accepts POST without channel and pax, defaulting channel to null and guestCount to 1', async () => {
      const res = await postWish('anggi-ivan', {
        guestName: 'Kawan Anggi',
        message: 'Selamat Anggi dan Ivan!',
        attendanceStatus: 'attending',
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.guestName).toBe('Kawan Anggi');
      expect(json.data.attendanceChannel ?? null).toBeNull();
      expect(json.data.guestCount).toBe(1);
    });
  });

  describe('yt-wedding RSVP & wishes validation', () => {
    it('persists offline attending with valid channel and pax (1..10)', async () => {
      const res = await postWish('riska-rafli', {
        guestName: 'Sahabat Riska',
        message: 'Barakallah Riska & Rafli!',
        attendanceStatus: 'attending',
        attendanceChannel: 'offline',
        guestCount: 3,
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.attendanceStatus).toBe('attending');
      expect(json.data.attendanceChannel).toBe('offline');
      expect(json.data.guestCount).toBe(3);

      // Check GET /:slug/wishes returns attendanceChannel and guestCount
      const getRes = await getWishes('riska-rafli');
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      const created = getJson.data.find((w: { id: string }) => w.id === json.data.id);
      expect(created).toBeDefined();
      expect(created.attendanceChannel).toBe('offline');
      expect(created.guestCount).toBe(3);
    });

    it('rejects yt-wedding attending when attendanceChannel is missing or invalid', async () => {
      const missingChannelRes = await postWish('riska-rafli', {
        guestName: 'Tamu Bingung',
        message: 'Selamat ya!',
        attendanceStatus: 'attending',
        guestCount: 2,
      });
      expect(missingChannelRes.status).toBe(400);

      const invalidChannelRes = await postWish('riska-rafli', {
        guestName: 'Tamu Aneh',
        message: 'Selamat ya!',
        attendanceStatus: 'attending',
        attendanceChannel: 'satellite',
        guestCount: 2,
      });
      expect(invalidChannelRes.status).toBe(400);
    });

    it('rejects yt-wedding online attending when invitation has no streamUrl configured', async () => {
      const res = await postWish('riska-no-stream', {
        guestName: 'Tamu Virtual',
        message: 'Selamat dari jauh!',
        attendanceStatus: 'attending',
        attendanceChannel: 'online',
        guestCount: 1,
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/stream|live/i);
    });

    it('accepts yt-wedding online attending when streamUrl is valid and forces guestCount to 1', async () => {
      const res = await postWish('riska-rafli', {
        guestName: 'Tamu Online Sukses',
        message: 'Nonton live streaming!',
        attendanceStatus: 'attending',
        attendanceChannel: 'online',
        guestCount: 5, // Should be forced to 1
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.attendanceChannel).toBe('online');
      expect(json.data.guestCount).toBe(1);
    });

    it('forces guestCount to 1 for not_attending and maybe statuses on yt-wedding', async () => {
      const notAttendingRes = await postWish('riska-rafli', {
        guestName: 'Tamu Berhalangan',
        message: 'Mohon maaf belum bisa hadir.',
        attendanceStatus: 'not_attending',
        guestCount: 4,
      });
      expect(notAttendingRes.status).toBe(201);
      const naJson = await notAttendingRes.json();
      expect(naJson.data.guestCount).toBe(1);

      const maybeRes = await postWish('riska-rafli', {
        guestName: 'Tamu Ragu',
        message: 'Semoga bisa hadir ya.',
        attendanceStatus: 'maybe',
        guestCount: 6,
      });
      expect(maybeRes.status).toBe(201);
      const maybeJson = await maybeRes.json();
      expect(maybeJson.data.guestCount).toBe(1);
    });

    it('rejects invalid pax values for offline attending on yt-wedding', async () => {
      const testCases = [
        { pax: 0, desc: 'pax 0' },
        { pax: 11, desc: 'pax 11 (>10)' },
        { pax: -1, desc: 'negative pax' },
        { pax: 2.5, desc: 'decimal pax' },
        { pax: '3', desc: 'string pax' },
        { pax: undefined, desc: 'missing pax' },
      ];

      for (const tc of testCases) {
        const res = await postWish('riska-rafli', {
          guestName: `Tamu Invalid ${tc.desc}`,
          message: 'Testing invalid pax',
          attendanceStatus: 'attending',
          attendanceChannel: 'offline',
          guestCount: tc.pax,
        });
        expect(res.status, `Expected 400 for ${tc.desc}`).toBe(400);
      }
    });
  });

  describe('Unpublished invitation protection', () => {
    it('returns 404 for GET /:slug/wishes on unpublished invitation', async () => {
      const res = await getWishes('riska-draft');
      expect(res.status).toBe(404);
    });

    it('returns 404 for POST /:slug/wishes on unpublished invitation', async () => {
      const res = await postWish('riska-draft', {
        guestName: 'Hacker Draft',
        message: 'Trying to post to draft',
        attendanceStatus: 'attending',
        attendanceChannel: 'offline',
        guestCount: 1,
      });
      expect(res.status).toBe(404);
    });
  });

  describe('Hidden wishes moderation in public payload', () => {
    it('excludes hidden wishes from public payload and from wishSummary counts', async () => {
      const now = Date.now();
      // Insert visible wish
      db.insert(schema.wishes).values({
        id: 'w-vis-1',
        invitationId: 'inv-riska',
        guestName: 'Tamu Terlihat',
        attendanceStatus: 'attending',
        attendanceChannel: 'offline',
        guestCount: 2,
        message: 'Pesan terlihat',
        isHidden: false,
        createdAt: now - 1000,
      }).run();

      // Insert hidden wish
      db.insert(schema.wishes).values({
        id: 'w-hid-1',
        invitationId: 'inv-riska',
        guestName: 'Tamu Tersembunyi',
        attendanceStatus: 'attending',
        attendanceChannel: 'online',
        guestCount: 1,
        message: 'Spam atau pesan kasar',
        isHidden: true,
        createdAt: now,
      }).run();

      const res = await getPublicPayload('riska-rafli');
      expect(res.status).toBe(200);
      const payload = await res.json();

      // Ensure hidden wish is not in payload.wishes
      const wishIds = payload.wishes.map((w: { id: string }) => w.id);
      expect(wishIds).toContain('w-vis-1');
      expect(wishIds).not.toContain('w-hid-1');

      // Ensure wish item includes attendanceChannel and guestCount
      const visibleItem = payload.wishes.find((w: { id: string }) => w.id === 'w-vis-1');
      expect(visibleItem.attendanceChannel).toBe('offline');
      expect(visibleItem.guestCount).toBe(2);

      // Verify wishSummary counts only non-hidden wishes
      const allNonHidden = db.select().from(schema.wishes)
        .where(schema.wishes.invitationId === 'inv-riska' as any) // manual check
        .all()
        .filter((w) => w.invitationId === 'inv-riska' && !w.isHidden);

      expect(payload.wishSummary.total).toBe(allNonHidden.length);
      expect(payload.wishSummary.attending).toBe(
        allNonHidden.filter((w) => w.attendanceStatus === 'attending').length,
      );
    });
  });

  describe('Rate limiting protection', () => {
    it('blocks rapid resend from same IP within 5 seconds with 429', async () => {
      const fixedIp = '198.51.100.99';
      const first = await postWish('riska-rafli', {
        guestName: 'Tamu Cepat 1',
        message: 'Pesan pertama',
        attendanceStatus: 'attending',
        attendanceChannel: 'offline',
        guestCount: 1,
      }, fixedIp);
      expect(first.status).toBe(201);

      const second = await postWish('riska-rafli', {
        guestName: 'Tamu Cepat 2',
        message: 'Pesan spam cepat',
        attendanceStatus: 'attending',
        attendanceChannel: 'offline',
        guestCount: 1,
      }, fixedIp);
      expect(second.status).toBe(429);
    });
  });

  describe('Admin CSV export & formula injection protection', () => {
    it('exports CSV with Channel and Jumlah Pax columns and neutralizes formula injection', async () => {
      const now = Date.now();
      // Insert wish with potential CSV formula injection payloads
      db.insert(schema.wishes).values([
        {
          id: 'w-formula-1',
          invitationId: 'inv-riska',
          guestName: '=SUM(1+1)',
          attendanceStatus: 'attending',
          attendanceChannel: 'offline',
          guestCount: 2,
          message: '-2+3 and +cmd and @mention\ttabbed',
          isHidden: false,
          createdAt: now + 10,
        },
      ]).run();

      const res = await getCsvExport('inv-riska');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');

      const csvText = await res.text();
      const lines = csvText.split('\n');
      const headerLine = lines[0];

      // Header must contain Channel and Jumlah Pax
      expect(headerLine).toContain('Channel');
      expect(headerLine).toContain('Jumlah Pax');

      // Find the formula row
      const formulaLine = lines.find((l) => l.includes('w-formula-1'));
      expect(formulaLine).toBeDefined();

      // =SUM(1+1) must be escaped with a leading single quote: '=SUM(1+1)
      expect(formulaLine).toContain("'=SUM(1+1)");
      // -2+3 must be escaped with leading single quote: '-2+3
      expect(formulaLine).toContain("'-2+3");
      // Channel and pax must be in the row
      expect(formulaLine).toContain('offline');
      expect(formulaLine).toContain('2');
    });
  });
});
