import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { LoveStoryItem } from '@you-are-invited/shared-types';
import { defaultLoveStoryItems, LOVE_STORY_FIELD_KEY } from '../../lib/love-story.js';

const tempDir = mkdtempSync(path.join(tmpdir(), 'yai-love-story-'));
const previousCwd = process.cwd();
const previousDatabaseUrl = process.env.DATABASE_URL;

process.env.DATABASE_URL = path.join(tempDir, 'test.sqlite');
process.chdir(tempDir);

let app: Hono;
let db: typeof import('../../db/client.js').db;
let sqlite: typeof import('../../db/client.js').sqlite;
let schema: typeof import('../../db/schema.js');

beforeAll(async () => {
  schema = await import('../../db/schema.js');
  ({ db, sqlite } = await import('../../db/client.js'));
  const { adminInvitationsRouter } = await import('./invitations.js');
  const { invitationsRouter } = await import('../invitations.js');
  const now = Date.now();
  db.insert(schema.templates).values({ id: 'raden-motion', displayName: 'Raden Motion' }).run();
  db.insert(schema.invitations).values([
    { id: 'inv-anggi', slug: 'anggi-ivan', title: 'Anggi & Ivan', templateKey: 'raden-motion', createdAt: now, updatedAt: now },
    { id: 'inv-other', slug: 'other-couple', title: 'Other Couple', templateKey: 'raden-motion', createdAt: now, updatedAt: now },
  ]).run();
  db.insert(schema.invitationAssets).values([
    { id: 'image-anggi', invitationId: 'inv-anggi', kind: 'image', storagePath: '/tmp/anggi.jpg', mimeType: 'image/jpeg', originalFilename: 'anggi.jpg', createdAt: now },
    { id: 'image-other', invitationId: 'inv-other', kind: 'image', storagePath: '/tmp/other.jpg', mimeType: 'image/jpeg', originalFilename: 'other.jpg', createdAt: now },
    { id: 'audio-anggi', invitationId: 'inv-anggi', kind: 'audio', storagePath: '/tmp/music.mp3', mimeType: 'audio/mpeg', originalFilename: 'music.mp3', createdAt: now },
  ]).run();
  app = new Hono();
  app.route('/api/admin/invitations', adminInvitationsRouter);
  app.route('/api/invitations', invitationsRouter);
});

afterAll(() => {
  sqlite?.close();
  process.chdir(previousCwd);
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  rmSync(tempDir, { recursive: true, force: true });
});

function storyDraft(photoAssetId: string | null = null): LoveStoryItem[] {
  return defaultLoveStoryItems().map((item, index) => ({
    ...item,
    title: `Cerita ${index + 1}`,
    description: index === 0 ? 'Deskripsi dari klien.' : '',
    photoAssetId: index === 0 ? photoAssetId : null,
    photoUrl: null,
  }));
}

describe('anggi-ivan Love Story', () => {
  it('loads three blank admin defaults and keeps them private on the public page', async () => {
    const adminResponse = await app.request('/api/admin/invitations/inv-anggi');
    expect(adminResponse.status).toBe(200);
    const adminPayload = await adminResponse.json() as { loveStory: LoveStoryItem[] };
    expect(adminPayload.loveStory.map((item) => item.title)).toEqual([
      'Awal Bertemu', 'Acara Lamaran', 'Acara Pernikahan',
    ]);
    expect(adminPayload.loveStory.every((item) => !item.description && !item.photoAssetId)).toBe(true);

    const publicResponse = await app.request('/api/invitations/anggi-ivan');
    expect(publicResponse.status).toBe(200);
    const publicPayload = await publicResponse.json() as { loveStory: LoveStoryItem[]; templateFields: Record<string, string> };
    expect(publicPayload.loveStory).toEqual([]);
    expect(publicPayload.templateFields[LOVE_STORY_FIELD_KEY]).toBeUndefined();
  });

  it('saves the complete invitation payload sent by the admin editor', async () => {
    const adminResponse = await app.request('/api/admin/invitations/inv-anggi');
    const adminPayload = await adminResponse.json() as {
      invitation: Record<string, unknown>;
      loveStory: LoveStoryItem[];
    };
    const loveStory = storyDraft('image-anggi');
    const response = await app.request('/api/admin/invitations/inv-anggi', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...adminPayload.invitation,
        loveStory: loveStory.map(({ photoUrl: _photoUrl, ...item }) => item),
      }),
    });
    expect(response.status).toBe(200);

    const refreshedResponse = await app.request('/api/admin/invitations/inv-anggi');
    const refreshed = await refreshedResponse.json() as { loveStory: LoveStoryItem[] };
    expect(refreshed.loveStory[0].description).toBe('Deskripsi dari klien.');
    expect(refreshed.loveStory[0].photoAssetId).toBe('image-anggi');

    const publicResponse = await app.request('/api/invitations/anggi-ivan');
    const publicPayload = await publicResponse.json() as { loveStory: LoveStoryItem[] };
    expect(publicPayload.loveStory[0].photoUrl).toBe('/api/assets/image-anggi');
  });

  it('persists ordered content and exposes only validated same-invitation image URLs', async () => {
    const draft = storyDraft('image-anggi');
    [draft[0], draft[2]] = [draft[2], draft[0]];
    draft.forEach((item, sortOrder) => { item.sortOrder = sortOrder; });
    const saveResponse = await app.request('/api/admin/invitations/inv-anggi', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loveStory: draft }),
    });
    expect(saveResponse.status).toBe(200);

    const storedField = db.select().from(schema.invitationTemplateFields)
      .where(eq(schema.invitationTemplateFields.fieldKey, LOVE_STORY_FIELD_KEY)).get();
    expect(storedField?.invitationId).toBe('inv-anggi');

    const publicResponse = await app.request('/api/invitations/anggi-ivan');
    const publicPayload = await publicResponse.json() as { loveStory: LoveStoryItem[] };
    expect(publicPayload.loveStory.map((item) => item.title)).toEqual(['Cerita 3', 'Cerita 2', 'Cerita 1']);
    expect(publicPayload.loveStory[2].photoUrl).toBe('/api/assets/image-anggi');
    expect(publicPayload.loveStory[2].description).toBe('Deskripsi dari klien.');
  });

  it('rejects malformed data and assets owned by another invitation or of the wrong kind without replacing saved data', async () => {
    const original = db.select().from(schema.invitationTemplateFields)
      .where(eq(schema.invitationTemplateFields.fieldKey, LOVE_STORY_FIELD_KEY)).get()?.fieldValue;
    const cases = [
      storyDraft('image-other'),
      storyDraft('audio-anggi'),
      storyDraft().slice(0, 2),
    ];
    for (const loveStory of cases) {
      const response = await app.request('/api/admin/invitations/inv-anggi', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loveStory }),
      });
      expect(response.status).toBe(400);
    }
    const after = db.select().from(schema.invitationTemplateFields)
      .where(eq(schema.invitationTemplateFields.fieldKey, LOVE_STORY_FIELD_KEY)).get()?.fieldValue;
    expect(after).toBe(original);

    const otherResponse = await app.request('/api/admin/invitations/inv-other', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loveStory: storyDraft() }),
    });
    expect(otherResponse.status).toBe(400);
  });
});
