# Riska Client Revisions

Status: approved by user on 2026-11-22 after reviewing short design in conversation.

## Intent
Apply client revisions to Riska/Rafly while preserving existing template visuals and making content maintainable through current admin dashboard.

## Approved approach
- Reuse each couple's existing `fatherName` and `motherName`; store the client-approved names with `Bapak` / `Ibu` salutations in local admin only. Existing binder renders these in profiles and closing. Do not automatically prepend salutations or add separate fields. Private names are intentionally omitted from Git documentation.
- Reuse `shippingAddress` / `yt_shipping_address` in Pengaturan YouTube. Existing binder places its text after all bank accounts in Kirim Hadiah Langsung. Save client-approved delivery text prefixed `Kirim hadiah ke alamat ini:` in local admin only. Private delivery address is intentionally omitted from Git documentation.
- Add hero-only horizontal and vertical focal controls, 0–100%, in Foto & Media beside hero photo. Reuse existing yt-wedding settings endpoint and template-field storage; no schema migration. Default 50% / 50% preserves old rendering. Native `object-position` changes only hero still-image content, not frame size, CSS classes, original image, avatars, cover, gallery, or video.

## Alternatives
Separate salutation fields and full crop editor were rejected in favor of existing content fields and two native percentage controls: less code, no duplicate state, no destructive image processing. Hardcoded names/address or positioning all images would undermine maintainability and isolation.

## Interfaces and behavior
Builder choice: `heroPhotoPositionX?: number | null` and `heroPhotoPositionY?: number | null` on `YTWeddingSettingsInput`; stored as `yt_hero_photo_position_x` / `yt_hero_photo_position_y`. Accept finite numbers inclusively between 0 and 100; null deletes override; reject strings, booleans, arrays and out-of-range input with HTTP 400 before writes. Omitted axes retain saved values. Invalid legacy values fall back independently to 50; zero remains valid.

Admin uses labeled native range inputs with visible percentages, defaults 50/50, step 1. A dedicated `Simpan Posisi Foto` button PATCHes only these axes, reports API errors, reads saved values back, and refreshes preview after successful save. Show immediate image-only preview using same `object-fit: cover` / 16:9 frame. Do not send unrelated gallery/gift settings. Reset restores controls to 50/50, persisted by same save button. Existing general settings save must not reset focal overrides.

## Constraints and acceptance
- User-approved visual exception is limited to configurable hero image focal position. Original HTML/CSS/layout/fonts/animations otherwise unchanged; no new dependency.
- No changes to original template at `D:\Nuno\you-are-invited-template` or other invitations, especially Anggi/Ivan.
- Preserve current locally entered client data; never reseed or import fixtures. Verify current values before scoped admin updates. No production deployment, publish/unpublish, account changes, or guessed data.
- Keep existing hero video behavior unchanged; controls target still image only.
- Browser verification uses authenticated local session. Tests use temporary DB. Record original hero position if present; pick useful vertical focal position after previewing current actual image, never claim one position fits every viewport without checking.
- Requested salutation and address appear after reload; position survives reload; hero box dimensions unchanged on phone/tablet/desktop; other image styles unchanged; original media remains byte-identical.

## Non-goals
Fix event-save validation, change global Save semantics, introduce separate salutation model, build crop/zoom editor, redesign gift sheet, alter gallery state, establish licensing or claim full-template pixel parity.
