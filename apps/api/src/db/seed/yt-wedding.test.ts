import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';

const tempDir = mkdtempSync(path.join(tmpdir(), 'yai-seed-yt-'));
const previousCwd = process.cwd();
const previousDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = path.join(tempDir, 'test.sqlite');
process.chdir(tempDir);

let db: typeof import('../client.js').db;
let sqlite: typeof import('../client.js').sqlite;
let schema: typeof import('../schema.js');
let seedTemplates: typeof import('./templates.js').seedTemplates;

beforeAll(async () => {
  schema = await import('../schema.js');
  ({ db, sqlite } = await import('../client.js'));
  ({ seedTemplates } = await import('./templates.js'));
});

afterAll(() => {
  sqlite?.close();
  process.chdir(previousCwd);
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  rmSync(tempDir, { recursive: true, force: true });
});

describe('Task 3: yt-wedding seed and draft isolation', () => {
  it('upserts yt-wedding template catalog entry', async () => {
    await seedTemplates();
    const tmpl = db.select().from(schema.templates).where(eq(schema.templates.id, 'yt-wedding')).get();
    expect(tmpl).toBeDefined();
    expect(tmpl?.displayName).toBe('YT Wedding');
  });

  it('skips riska-rafli draft creation and emits diagnostic when no super_admin exists', async () => {
    // In fresh DB with no adminUsers:
    const admins = db.select().from(schema.adminUsers).all();
    expect(admins.length).toBe(0);

    const warnSpy = vi.spyOn(console, 'warn');
    await seedTemplates();

    const riska = db.select().from(schema.invitations).where(eq(schema.invitations.slug, 'riska-rafli')).get();
    expect(riska).toBeUndefined();

    // Must not invent credentials or dummy users
    const adminsAfter = db.select().from(schema.adminUsers).all();
    expect(adminsAfter.length).toBe(0);

    // Actionable diagnostic emitted
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/super_admin/i));
    warnSpy.mockRestore();
  });

  it('seeds riska-rafli as unpublished draft owned by super_admin when super_admin exists', async () => {
    const now = Date.now();
    const superAdminId = 'admin-super-1';
    db.insert(schema.adminUsers).values({
      id: superAdminId,
      email: 'super@you-are-invited.my.id',
      passwordHash: 'dummy-hash',
      role: 'super_admin',
      createdAt: now,
    }).run();

    await seedTemplates();

    const riska = db.select().from(schema.invitations).where(eq(schema.invitations.slug, 'riska-rafli')).get();
    expect(riska).toBeDefined();
    expect(riska?.slug).toBe('riska-rafli');
    expect(riska?.templateKey).toBe('yt-wedding');
    expect(riska?.isPublished).toBe(false);
    expect(riska?.ownerUserId).toBe(superAdminId);
  });

  it('is idempotent: running seed repeatedly never overwrites, resets, or mutates populated fields (neither Anggi nor Riska)', async () => {
    // Modify Riska fields to simulate operator changes
    const riskaBefore = db.select().from(schema.invitations).where(eq(schema.invitations.slug, 'riska-rafli')).get()!;
    db.update(schema.invitations)
      .set({
        title: 'Custom Riska & Rafli Title',
        hashtag: '#CustomRiskaHashtag',
        theme: 'custom-dark',
        updatedAt: 999999,
      })
      .where(eq(schema.invitations.id, riskaBefore.id))
      .run();

    // Modify Anggi fields to simulate operator changes
    const anggiBefore = db.select().from(schema.invitations).where(eq(schema.invitations.slug, 'anggi-ivan')).get()!;
    db.update(schema.invitations)
      .set({
        title: 'Custom Anggi Title',
        hashtag: '#AnggiIvanForeverCustom',
        updatedAt: 888888,
      })
      .where(eq(schema.invitations.id, anggiBefore.id))
      .run();

    const anggiSnapshot = db.select().from(schema.invitations).where(eq(schema.invitations.slug, 'anggi-ivan')).get()!;
    const riskaSnapshot = db.select().from(schema.invitations).where(eq(schema.invitations.slug, 'riska-rafli')).get()!;
    const anggiGiftsSnapshot = db.select().from(schema.giftAccounts).where(eq(schema.giftAccounts.invitationId, anggiBefore.id)).all();

    // Run seed again
    await seedTemplates();

    const anggiAfter = db.select().from(schema.invitations).where(eq(schema.invitations.slug, 'anggi-ivan')).get()!;
    const riskaAfter = db.select().from(schema.invitations).where(eq(schema.invitations.slug, 'riska-rafli')).get()!;
    const anggiGiftsAfter = db.select().from(schema.giftAccounts).where(eq(schema.giftAccounts.invitationId, anggiBefore.id)).all();

    // Riska must be unchanged
    expect(riskaAfter.title).toBe('Custom Riska & Rafli Title');
    expect(riskaAfter.hashtag).toBe('#CustomRiskaHashtag');
    expect(riskaAfter.theme).toBe('custom-dark');
    expect(riskaAfter.updatedAt).toBe(999999);
    expect(riskaAfter.isPublished).toBe(false);
    expect(riskaAfter).toEqual(riskaSnapshot);

    // Anggi must be unchanged
    expect(anggiAfter.title).toBe('Custom Anggi Title');
    expect(anggiAfter.hashtag).toBe('#AnggiIvanForeverCustom');
    expect(anggiAfter.updatedAt).toBe(888888);
    expect(anggiAfter).toEqual(anggiSnapshot);

    // Anggi gifts must be unchanged
    expect(anggiGiftsAfter).toEqual(anggiGiftsSnapshot);
  });
});
