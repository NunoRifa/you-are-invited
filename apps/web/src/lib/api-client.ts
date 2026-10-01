import type { PublicInvitationPayload, CreateWishInput, Wish, TemplateListItem } from '@you-are-invited/shared-types';

const API_BASE = '/api';

export async function fetchInvitation(slug: string): Promise<PublicInvitationPayload> {
  const res = await fetch(`${API_BASE}/invitations/${slug}`);
  if (!res.ok) {
    throw new Error(`Gagal memuat undangan: ${res.statusText}`);
  }
  return res.json();
}

export interface WishCursor {
  createdAt: number;
  id: string;
}

export async function fetchWishes(slug: string, cursor?: WishCursor, limit = 10): Promise<{ data: Wish[]; nextCursor: WishCursor | null }> {
  const url = new URL(`${API_BASE}/invitations/${slug}/wishes`, window.location.origin);
  if (cursor) {
    url.searchParams.set('cursor', String(cursor.createdAt));
    url.searchParams.set('cursorId', cursor.id);
  }
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error('Gagal memuat ucapan');
  }
  return res.json();
}

export async function submitWish(slug: string, input: CreateWishInput): Promise<{ success: boolean; data: Wish }> {
  const res = await fetch(`${API_BASE}/invitations/${slug}/wishes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Gagal mengirim ucapan' }));
    throw new Error(errorData.error || 'Gagal mengirim ucapan');
  }
  return res.json();
}

export async function fetchTemplates(): Promise<TemplateListItem[]> {
  const res = await fetch(`${API_BASE}/templates`);
  if (!res.ok) {
    throw new Error('Gagal memuat daftar template');
  }
  return res.json();
}
