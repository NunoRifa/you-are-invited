import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';

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

    const couples = db.select().from(schema.couples).where(eq(schema.couples.invitationId, riska!.id)).all();
    expect(couples).toHaveLength(2);
    expect(couples.map((couple) => couple.role).sort()).toEqual(['bride', 'groom']);
    for (const couple of couples) {
      expect(couple.fullName).toBe('');
      expect(couple.displayName).toBe('');
      expect(couple.fatherName).toBeNull();
      expect(couple.motherName).toBeNull();
      expect(couple.photoAssetId).toBeNull();
    }
    const gallerySetting = db.select().from(schema.invitationTemplateFields).where(and(
      eq(schema.invitationTemplateFields.invitationId, riska!.id),
      eq(schema.invitationTemplateFields.fieldKey, 'yt_show_gallery'),
    )).get();
    expect(gallerySetting?.fieldValue).toBe('false');
    const visibilitySource = db.select().from(schema.invitationTemplateFields).where(and(
      eq(schema.invitationTemplateFields.invitationId, riska!.id),
      eq(schema.invitationTemplateFields.fieldKey, 'yt_gallery_visibility_source'),
    )).get();
    expect(visibilitySource?.fieldValue).toBe('auto');

    // A public request remains private until the explicit publication workflow runs.
    const { invitationPageRouter } = await import('../../routes/invitation-page.js');
    const { Hono } = await import('hono');
    const app = new Hono();
    app.route('/i', invitationPageRouter);
    const publicResponse = await app.request('/i/riska-rafli');
    expect(publicResponse.status).toBe(404);
  });

  it('seeds gallery hidden only when the setting is absent and no gallery rows exist', async () => {
    const riska = db.select().from(schema.invitations).where(eq(schema.invitations.slug, 'riska-rafli')).get()!;
    // Remove prior test's seed default to construct empty gallery + absent setting state.
    db.delete(schema.invitationTemplateFields).where(and(
      eq(schema.invitationTemplateFields.invitationId, riska.id),
      eq(schema.invitationTemplateFields.fieldKey, 'yt_show_gallery'),
    )).run();
    const gallery = db.select().from(schema.galleryImages).where(eq(schema.galleryImages.invitationId, riska.id)).all();
    const setting = db.select().from(schema.invitationTemplateFields).where(and(
      eq(schema.invitationTemplateFields.invitationId, riska.id),
      eq(schema.invitationTemplateFields.fieldKey, 'yt_show_gallery'),
    )).get();
    expect(gallery).toHaveLength(0);
    expect(setting).toBeUndefined();

    await seedTemplates();

    const seededSetting = db.select().from(schema.invitationTemplateFields).where(and(
      eq(schema.invitationTemplateFields.invitationId, riska.id),
      eq(schema.invitationTemplateFields.fieldKey, 'yt_show_gallery'),
    )).get();
    expect(seededSetting?.fieldValue).toBe('false');
  });

  it('does not duplicate default bride and groom slots on repeated seed', async () => {
    const riska = db.select().from(schema.invitations).where(eq(schema.invitations.slug, 'riska-rafli')).get()!;
    await seedTemplates();
    await seedTemplates();
    const couples = db.select().from(schema.couples).where(eq(schema.couples.invitationId, riska.id)).all();
    expect(couples).toHaveLength(2);
    expect(couples.map((couple) => couple.role).sort()).toEqual(['bride', 'groom']);
  });

  it('preserves existing populated couple row and adds only missing role', async () => {
    const riska = db.select().from(schema.invitations).where(eq(schema.invitations.slug, 'riska-rafli')).get()!;
    db.delete(schema.couples).where(eq(schema.couples.invitationId, riska.id)).run();
    const bride = {
      id: 'custom-riska-bride',
      invitationId: riska.id,
      role: 'bride' as const,
      fullName: 'Custom Bride Full Name',
      displayName: 'Custom Bride',
      fatherName: 'Custom Father',
      motherName: 'Custom Mother',
      birthOrderLabel: 'First Daughter',
      instagramHandle: 'custom-bride',
      photoAssetId: null,
    };
    db.insert(schema.couples).values(bride).run();

    await seedTemplates();

    expect(db.select().from(schema.couples).where(eq(schema.couples.id, bride.id)).get()).toEqual(bride);
    const couples = db.select().from(schema.couples).where(eq(schema.couples.invitationId, riska.id)).all();
    expect(couples).toHaveLength(2);
    const groom = couples.find((couple) => couple.role === 'groom');
    expect(groom).toMatchObject({
      id: 'c-riska-groom',
      fullName: '',
      displayName: '',
      fatherName: null,
      motherName: null,
      photoAssetId: null,
    });
  });

  it.each(['true', 'false'])('preserves explicit yt_show_gallery=%s setting', async (value) => {
    const riska = db.select().from(schema.invitations).where(eq(schema.invitations.slug, 'riska-rafli')).get()!;
    db.delete(schema.invitationTemplateFields).where(and(
      eq(schema.invitationTemplateFields.invitationId, riska.id),
      eq(schema.invitationTemplateFields.fieldKey, 'yt_show_gallery'),
    )).run();
    db.insert(schema.invitationTemplateFields).values({
      id: `tf-gallery-${value}`,
      invitationId: riska.id,
      fieldKey: 'yt_show_gallery',
      fieldValue: value,
    }).run();
    await seedTemplates();
    const settings = db.select().from(schema.invitationTemplateFields).where(and(
      eq(schema.invitationTemplateFields.invitationId, riska.id),
      eq(schema.invitationTemplateFields.fieldKey, 'yt_show_gallery'),
    )).all();
    expect(settings).toHaveLength(1);
    expect(settings[0].fieldValue).toBe(value);
  });

  it('does not seed yt_show_gallery=false when gallery already has images', async () => {
    const riska = db.select().from(schema.invitations).where(eq(schema.invitations.slug, 'riska-rafli')).get()!;
    db.delete(schema.invitationTemplateFields).where(and(
      eq(schema.invitationTemplateFields.invitationId, riska.id),
      eq(schema.invitationTemplateFields.fieldKey, 'yt_show_gallery'),
    )).run();
    db.insert(schema.invitationAssets).values({
      id: 'riska-gallery-asset', invitationId: riska.id, kind: 'image',
      storagePath: 'storage/uploads/riska-gallery.jpg', mimeType: 'image/jpeg',
      originalFilename: 'riska-gallery.jpg', createdAt: Date.now(),
    }).run();
    db.insert(schema.galleryImages).values({
      id: 'riska-gallery-image', invitationId: riska.id,
      assetId: 'riska-gallery-asset', sortOrder: 0,
    }).run();
    await seedTemplates();
    const setting = db.select().from(schema.invitationTemplateFields).where(and(
      eq(schema.invitationTemplateFields.invitationId, riska.id),
      eq(schema.invitationTemplateFields.fieldKey, 'yt_show_gallery'),
    )).get();
    expect(setting).toBeUndefined();
    expect(db.select().from(schema.galleryImages).where(eq(schema.galleryImages.invitationId, riska.id)).all()).toHaveLength(1);
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
