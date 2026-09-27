export type QuoteBlockPosition = 'hero' | 'closing' | 'none';
export type GalleryVideoType = 'none' | 'youtube' | 'hosted';

export interface TemplateManifest {
  id: string;
  displayName: string;
  description?: string;
  previewImagePath?: string;
  supportsPantun: boolean;
  supportsHeroVideo: boolean;
  quoteBlockPosition: QuoteBlockPosition;
  galleryVideoType: GalleryVideoType;
  isActive: boolean;
}

export interface TemplateListItem extends TemplateManifest {
  version?: string;
  author?: string;
}
