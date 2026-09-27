import { Hono } from 'hono';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { PublicInvitationPayload, WishSummary, Wish } from '@you-are-invited/shared-types';

export const invitationsRouter = new Hono();

invitationsRouter.get('/:slug', (c) => {
  const slug = c.req.param('slug');

  const inv = db
    .select()
    .from(schema.invitations)
    .where(eq(schema.invitations.slug, slug))
    .get();

  if (!inv || !inv.isPublished) {
    return c.json({ error: 'Invitation not found' }, 404);
  }

  // Fetch relations
  const couplesList = db
    .select()
    .from(schema.couples)
    .where(eq(schema.couples.invitationId, inv.id))
    .all();

  const eventsList = db
    .select()
    .from(schema.events)
    .where(eq(schema.events.invitationId, inv.id))
    .orderBy(schema.events.sortOrder)
    .all();

  const galleryList = db
    .select()
    .from(schema.galleryImages)
    .where(eq(schema.galleryImages.invitationId, inv.id))
    .orderBy(schema.galleryImages.sortOrder)
    .all();

  const storyList = db
    .select()
    .from(schema.storyItems)
    .where(eq(schema.storyItems.invitationId, inv.id))
    .orderBy(schema.storyItems.sortOrder)
    .all();

  const giftList = db
    .select()
    .from(schema.giftAccounts)
    .where(eq(schema.giftAccounts.invitationId, inv.id))
    .orderBy(schema.giftAccounts.sortOrder)
    .all();

  const livestream = db
    .select()
    .from(schema.livestreamInfo)
    .where(eq(schema.livestreamInfo.invitationId, inv.id))
    .get();

  const templateFieldsList = db
    .select()
    .from(schema.invitationTemplateFields)
    .where(eq(schema.invitationTemplateFields.invitationId, inv.id))
    .all();

  const templateFieldsRecord: Record<string, string> = {};
  for (const f of templateFieldsList) {
    templateFieldsRecord[f.fieldKey] = f.fieldValue;
  }

  // Wishes stats
  const allWishes = db
    .select()
    .from(schema.wishes)
    .where(and(eq(schema.wishes.invitationId, inv.id), eq(schema.wishes.isHidden, false)))
    .all();

  const wishSummary: WishSummary = {
    total: allWishes.length,
    attending: allWishes.filter((w) => w.attendanceStatus === 'attending').length,
    notAttending: allWishes.filter((w) => w.attendanceStatus === 'not_attending').length,
    maybe: allWishes.filter((w) => w.attendanceStatus === 'maybe').length,
  };

  // Recent 10 wishes
  const recentWishes = db
    .select()
    .from(schema.wishes)
    .where(and(eq(schema.wishes.invitationId, inv.id), eq(schema.wishes.isHidden, false)))
    .orderBy(desc(schema.wishes.createdAt))
    .limit(10)
    .all();

  // Background music asset if exists
  const musicAsset = db
    .select()
    .from(schema.invitationAssets)
    .where(and(eq(schema.invitationAssets.invitationId, inv.id), eq(schema.invitationAssets.kind, 'audio')))
    .get();

  const payload: PublicInvitationPayload = {
    invitation: {
      id: inv.id,
      slug: inv.slug,
      ownerUserId: inv.ownerUserId,
      title: inv.title,
      templateKey: inv.templateKey,
      openingGreetingText: inv.openingGreetingText,
      closingText: inv.closingText,
      quoteText: inv.quoteText,
      quoteSource: inv.quoteSource,
      coverGuestLabelDefault: inv.coverGuestLabelDefault,
      hashtag: inv.hashtag,
      theme: inv.theme,
      isPublished: inv.isPublished,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    },
    couples: couplesList.map((c) => ({
      id: c.id,
      invitationId: c.invitationId,
      role: c.role as 'bride' | 'groom',
      fullName: c.fullName,
      displayName: c.displayName,
      fatherName: c.fatherName,
      motherName: c.motherName,
      birthOrderLabel: c.birthOrderLabel,
      instagramHandle: c.instagramHandle,
      photoAssetId: c.photoAssetId,
      photoUrl: c.photoAssetId ? `/api/assets/${c.photoAssetId}` : null,
    })),
    events: eventsList.map((e) => ({
      id: e.id,
      invitationId: e.invitationId,
      label: e.label,
      date: e.date,
      startTime: e.startTime,
      endTimeLabel: e.endTimeLabel,
      venueName: e.venueName,
      venueAddress: e.venueAddress,
      mapsUrl: e.mapsUrl,
      sortOrder: e.sortOrder,
    })),
    gallery: galleryList.map((g) => ({
      id: g.id,
      invitationId: g.invitationId,
      assetId: g.assetId,
      caption: g.caption,
      sortOrder: g.sortOrder,
      url: `/api/assets/${g.assetId}`,
    })),
    story: storyList.map((s) => ({
      id: s.id,
      invitationId: s.invitationId,
      title: s.title,
      date: s.date,
      description: s.description,
      sortOrder: s.sortOrder,
    })),
    giftAccounts: giftList.map((g) => ({
      id: g.id,
      invitationId: g.invitationId,
      holderName: g.holderName,
      accountNumber: g.accountNumber,
      providerName: g.providerName,
      sortOrder: g.sortOrder,
    })),
    livestream: livestream ? {
      id: livestream.id,
      invitationId: livestream.invitationId,
      label: livestream.label,
      date: livestream.date,
      timeLabel: livestream.timeLabel,
      streamUrl: livestream.streamUrl,
    } : null,
    templateFields: templateFieldsRecord,
    musicUrl: musicAsset ? `/api/assets/${musicAsset.id}` : null,
    wishes: recentWishes.map((w) => ({
      id: w.id,
      invitationId: w.invitationId,
      guestName: w.guestName,
      attendanceStatus: w.attendanceStatus as 'attending' | 'not_attending' | 'maybe',
      message: w.message,
      isHidden: w.isHidden,
      createdAt: w.createdAt,
    })),
    wishSummary,
  };

  return c.json(payload);
});
