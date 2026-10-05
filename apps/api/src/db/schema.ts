import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  previewImagePath: text('preview_image_path'),
  supportsPantun: integer('supports_pantun', { mode: 'boolean' }).notNull().default(false),
  supportsHeroVideo: integer('supports_hero_video', { mode: 'boolean' }).notNull().default(false),
  quoteBlockPosition: text('quote_block_position', { enum: ['hero', 'closing', 'none'] }).notNull().default('none'),
  galleryVideoType: text('gallery_video_type', { enum: ['none', 'youtube', 'hosted'] }).notNull().default('none'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const adminUsers = sqliteTable('admin_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['owner', 'super_admin'] }).notNull().default('owner'),
  createdAt: integer('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => adminUsers.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
});

export const invitations = sqliteTable('invitations', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  ownerUserId: text('owner_user_id').references(() => adminUsers.id),
  title: text('title').notNull(),
  templateKey: text('template_key').notNull().references(() => templates.id),
  openingGreetingText: text('opening_greeting_text'),
  closingText: text('closing_text'),
  quoteText: text('quote_text'),
  quoteSource: text('quote_source'),
  coverGuestLabelDefault: text('cover_guest_label_default').notNull().default('Tamu Undangan'),
  hashtag: text('hashtag'),
  theme: text('theme'),
  coupleDisplayName: text('couple_display_name'),
  coverPhotoAssetId: text('cover_photo_asset_id'),
  isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('invitations_slug_idx').on(table.slug),
]);

export const invitationTemplateFields = sqliteTable('invitation_template_fields', {
  id: text('id').primaryKey(),
  invitationId: text('invitation_id').notNull().references(() => invitations.id, { onDelete: 'cascade' }),
  fieldKey: text('field_key').notNull(),
  fieldValue: text('field_value').notNull(),
}, (table) => [
  index('inv_tmpl_fields_idx').on(table.invitationId, table.fieldKey),
]);

export const invitationAssets = sqliteTable('invitation_assets', {
  id: text('id').primaryKey(),
  invitationId: text('invitation_id').notNull().references(() => invitations.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['image', 'audio', 'font'] }).notNull(),
  storagePath: text('storage_path').notNull(),
  mimeType: text('mime_type').notNull(),
  originalFilename: text('original_filename').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const couples = sqliteTable('couples', {
  id: text('id').primaryKey(),
  invitationId: text('invitation_id').notNull().references(() => invitations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['bride', 'groom'] }).notNull(),
  fullName: text('full_name').notNull(),
  displayName: text('display_name').notNull(),
  fatherName: text('father_name'),
  motherName: text('mother_name'),
  birthOrderLabel: text('birth_order_label'),
  instagramHandle: text('instagram_handle'),
  photoAssetId: text('photo_asset_id').references(() => invitationAssets.id),
});

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  invitationId: text('invitation_id').notNull().references(() => invitations.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  date: text('date').notNull(),
  startTime: text('start_time').notNull(),
  endTimeLabel: text('end_time_label'),
  venueName: text('venue_name').notNull(),
  venueAddress: text('venue_address').notNull(),
  mapsUrl: text('maps_url'),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  index('events_invitation_sort_idx').on(table.invitationId, table.sortOrder),
]);

export const galleryImages = sqliteTable('gallery_images', {
  id: text('id').primaryKey(),
  invitationId: text('invitation_id').notNull().references(() => invitations.id, { onDelete: 'cascade' }),
  assetId: text('asset_id').notNull().references(() => invitationAssets.id),
  caption: text('caption'),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  index('gallery_invitation_sort_idx').on(table.invitationId, table.sortOrder),
]);

export const storyItems = sqliteTable('story_items', {
  id: text('id').primaryKey(),
  invitationId: text('invitation_id').notNull().references(() => invitations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  date: text('date').notNull(),
  description: text('description').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  index('story_invitation_sort_idx').on(table.invitationId, table.sortOrder),
]);

export const wishes = sqliteTable('wishes', {
  id: text('id').primaryKey(),
  invitationId: text('invitation_id').notNull().references(() => invitations.id, { onDelete: 'cascade' }),
  guestName: text('guest_name').notNull(),
  attendanceStatus: text('attendance_status', { enum: ['attending', 'not_attending', 'maybe'] }).notNull().default('attending'),
  message: text('message').notNull(),
  isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
}, (table) => [
  index('wishes_invitation_created_idx').on(table.invitationId, table.createdAt),
]);

export const giftAccounts = sqliteTable('gift_accounts', {
  id: text('id').primaryKey(),
  invitationId: text('invitation_id').notNull().references(() => invitations.id, { onDelete: 'cascade' }),
  holderName: text('holder_name').notNull(),
  accountNumber: text('account_number').notNull(),
  providerName: text('provider_name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const livestreamInfo = sqliteTable('livestream_info', {
  id: text('id').primaryKey(),
  invitationId: text('invitation_id').notNull().references(() => invitations.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  date: text('date').notNull(),
  timeLabel: text('time_label').notNull(),
  streamUrl: text('stream_url'),
});
