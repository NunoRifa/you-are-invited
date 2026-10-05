export type AttendanceStatus = 'attending' | 'not_attending' | 'maybe';
export type CoupleRole = 'bride' | 'groom';
export type AssetKind = 'image' | 'audio' | 'font';

export interface Invitation {
  id: string;
  slug: string;
  ownerUserId?: string | null;
  title: string;
  templateKey: string;
  openingGreetingText?: string | null;
  closingText?: string | null;
  quoteText?: string | null;
  quoteSource?: string | null;
  coverGuestLabelDefault: string;
  hashtag?: string | null;
  theme?: string | null;
  coupleDisplayName?: string | null;
  coverPhotoAssetId?: string | null;
  coverPhotoUrl?: string | null;
  isPublished: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Couple {
  id: string;
  invitationId: string;
  role: CoupleRole;
  fullName: string;
  displayName: string;
  fatherName?: string | null;
  motherName?: string | null;
  birthOrderLabel?: string | null;
  instagramHandle?: string | null;
  photoAssetId?: string | null;
  photoUrl?: string | null;
}

export interface EventItem {
  id: string;
  invitationId: string;
  label: string;
  date: string;
  startTime: string;
  endTimeLabel?: string | null;
  venueName: string;
  venueAddress: string;
  mapsUrl?: string | null;
  sortOrder: number;
}

export interface GalleryImage {
  id: string;
  invitationId: string;
  assetId: string;
  caption?: string | null;
  sortOrder: number;
  url: string;
}

export interface StoryItem {
  id: string;
  invitationId: string;
  title: string;
  date: string;
  description: string;
  sortOrder: number;
}

export interface Wish {
  id: string;
  invitationId: string;
  guestName: string;
  attendanceStatus: AttendanceStatus;
  message: string;
  isHidden: boolean;
  createdAt: number;
}

export interface GiftAccount {
  id: string;
  invitationId: string;
  holderName: string;
  accountNumber: string;
  providerName: string;
  sortOrder: number;
}

export interface InvitationAsset {
  id: string;
  invitationId: string;
  kind: AssetKind;
  storagePath: string;
  mimeType: string;
  originalFilename: string;
  createdAt: number;
}

export interface LivestreamInfo {
  id: string;
  invitationId: string;
  label: string;
  date: string;
  timeLabel: string;
  streamUrl?: string | null;
}

export interface InvitationTemplateField {
  fieldKey: string;
  fieldValue: string;
}

export interface WishSummary {
  total: number;
  attending: number;
  notAttending: number;
  maybe: number;
}

export interface CreateWishInput {
  guestName: string;
  attendanceStatus: AttendanceStatus;
  message: string;
  website_hp?: string; // honeypot field
  turnstileToken?: string; // Cloudflare Turnstile response token
}

export interface AdminLoginInput {
  email: string;
  password: string;
  turnstileToken?: string; // Cloudflare Turnstile response token
}

export interface PublicInvitationPayload {
  invitation: Invitation;
  couples: Couple[];
  events: EventItem[];
  gallery: GalleryImage[];
  story: StoryItem[];
  giftAccounts: GiftAccount[];
  livestream?: LivestreamInfo | null;
  templateFields: Record<string, string>;
  musicUrl?: string | null;
  wishes: Wish[];
  wishSummary: WishSummary;
}
