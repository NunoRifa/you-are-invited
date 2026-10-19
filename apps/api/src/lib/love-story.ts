import type { LoveStoryItem, LoveStoryKey } from '@you-are-invited/shared-types';

export const LOVE_STORY_FIELD_KEY = 'love_story_items';

const STORY_KEYS: LoveStoryKey[] = ['first-meeting', 'engagement', 'wedding'];
const DEFAULT_TITLES: Record<LoveStoryKey, string> = {
  'first-meeting': 'Awal Bertemu',
  engagement: 'Acara Lamaran',
  wedding: 'Acara Pernikahan',
};

export function defaultLoveStoryItems(): LoveStoryItem[] {
  return STORY_KEYS.map((id, sortOrder) => ({
    id,
    title: DEFAULT_TITLES[id],
    description: '',
    photoAssetId: null,
    photoUrl: null,
    sortOrder,
  }));
}

export function parseLoveStoryItems(value: unknown): LoveStoryItem[] | null {
  if (!Array.isArray(value) || value.length !== STORY_KEYS.length) return null;

  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  const parsed: LoveStoryItem[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== 'string' || !STORY_KEYS.includes(entry.id as LoveStoryKey)) return null;
    if (seenIds.has(entry.id)) return null;
    if (typeof entry.title !== 'string' || entry.title.length > 120) return null;
    if (typeof entry.description !== 'string' || entry.description.length > 5000) return null;
    if (!Number.isInteger(entry.sortOrder) || (entry.sortOrder as number) < 0 || (entry.sortOrder as number) >= STORY_KEYS.length) return null;
    if (seenOrders.has(entry.sortOrder as number)) return null;
    if (entry.photoAssetId !== null && (typeof entry.photoAssetId !== 'string' || entry.photoAssetId.length > 128)) return null;

    seenIds.add(entry.id);
    seenOrders.add(entry.sortOrder as number);
    parsed.push({
      id: entry.id as LoveStoryKey,
      title: entry.title,
      description: entry.description,
      photoAssetId: entry.photoAssetId as string | null,
      photoUrl: null,
      sortOrder: entry.sortOrder as number,
    });
  }

  if (seenIds.size !== STORY_KEYS.length || seenOrders.size !== STORY_KEYS.length) return null;
  return parsed.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function parseLoveStoryFieldValue(value: string | null | undefined): LoveStoryItem[] | null {
  if (!value || value.length > 20_000) return null;
  try {
    return parseLoveStoryItems(JSON.parse(value));
  } catch {
    return null;
  }
}
