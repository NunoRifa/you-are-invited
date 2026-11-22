# Riska Client Revisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply approved parent salutations and gift address using existing admin fields, and add persistent hero focal-position controls without redesigning template.

**Architecture:** Extend existing yt-wedding numeric settings through shared types, API allowlist and template-field map; bind verified percentages to hero still image only. Admin reuses existing editor and native range inputs. Names and address need scoped content updates, not new schema or hardcoded template text.

**Tech Stack:** TypeScript, Hono, SQLite/Drizzle, React, native CSS object-position, existing Vitest and Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-riska-client-revisions-design.md`

## Global Constraints
- User-approved visual exception is limited to configurable hero image focal position. Original HTML/CSS/layout/fonts/animations otherwise unchanged; no new dependency.
- No changes to original template at `D:\Nuno\you-are-invited-template` or other invitations, especially Anggi/Ivan.
- Preserve current locally entered client data; never reseed or import fixtures. Verify current values before scoped admin updates. No production deployment, publish/unpublish, account changes, or guessed data.
- Keep existing hero video behavior unchanged; controls target still image only.
- No commit or push unless separately requested. Implement on isolated worktree/feature branch; never overwrite current unrelated work.

## Review Focus
- Zero and fractional focal values must survive persistence; null resets only specified axis; omitted axis must not reset. Task 1 pins these inputs.
- Invalid or hostile legacy template-field strings must never reach inline CSS. Task 1 pins independent fallback to 50.
- Focal adjustment must not modify avatar/cover/gallery/video or original media/frame dimensions. Tasks 1 and 3 pin selector and browser dimensions.
- Dedicated save must not reset gallery visibility or overwrite unrelated content on failure. Tasks 2 and 3 verify request body, readback and error behavior.
- Existing titled parent names and gift address must round-trip without doubled prefixes, unsafe HTML or wrong invitation changes. Tasks 1 and 3 verify literal text and scoped content diffs.

---

### Task 1: Persist and bind hero focal position

**Files:**
- Modify: `packages/shared-types/src/invitation.ts` (`YTWeddingSettingsInput`).
- Modify: `apps/api/src/routes/admin/invitations.ts` (YT allowlist/map/validation).
- Modify: `apps/api/private-pages/yt-wedding/assets/js/bind.js` (hero image binding).
- Test: `apps/api/src/routes/admin/yt-wedding-settings.test.ts`.
- Test: `apps/api/src/routes/yt-wedding-fidelity.test.ts`.

**Interfaces:** Consume existing `PATCH /api/admin/invitations/:id/yt-wedding` authorization/transaction. Produce `heroPhotoPositionX?: number | null`, `heroPhotoPositionY?: number | null`; fields `yt_hero_photo_position_x`, `yt_hero_photo_position_y`; CSS `${x}% ${y}%` on `#hero-post .aspect-video > img` only.

- [ ] Add API tests `persists focal percentages without modifying other settings`: PATCH `{heroPhotoPositionX:0,heroPhotoPositionY:27.5}` succeeds; readback values are `'0'`, `'27.5'`; unrelated visibility unchanged. PATCH only X null deletes X, retains Y. Assert 400 and unchanged fields for -1, 101, string `'20'`, boolean, array and object values; existing ownership/template restrictions still apply.
- [ ] Add binder test `applies valid focal axes only to hero still image`: 0/27.5 gives `0% 27.5%`; absent/null/blank/hostile/nonfinite/out-of-range field gives independent 50 fallback; existing nonhero image `style.objectPosition` unchanged. Add literal text regression for parent names with Bapak/Ibu in profile and closing, no duplicated salutation; assert `style.css` hash stays unchanged through existing test.
- [ ] Run `npm --workspace=apps/api test -- src/routes/admin/yt-wedding-settings.test.ts src/routes/yt-wedding-fidelity.test.ts`. Expected: new focal tests fail before implementation; existing tests pass.
- [ ] Add shared optional numeric/null fields, allowlist/map entries and finite range validation before transaction. No DB migration. Bind validated numeric legacy values with absent/blank fallback independently; preserve 0. Leave hero video replacement behavior and all nonhero styles untouched.
- [ ] Re-run same command. Expected: all tests pass.

### Task 2: Add minimal native hero controls

**Files:** Modify `apps/web/src/routes/admin/editor.tsx` (state/readback/hero media card only). Existing YT settings panel remains unchanged unless types require additions; avoid sending axes in general settings save.

**Interfaces:** Consume Task 1 keys. Produce two labeled native sliders `Posisi Horizontal Foto Hero` and `Posisi Vertikal Foto Hero`, `min=0 max=100 step=1`, visible values, dedicated `Simpan Posisi Foto`, and `Reset Posisi` restoring unsaved 50/50. Immediate still-image preview in original 16:9 object-cover frame, no crop library.

- [ ] Define browser checks before editing: old payload shows 50/50; moving slider to 0 updates preview; save sends only `{heroPhotoPositionX,heroPhotoPositionY}` to `/yt-wedding`; reload persists values; reset returns 50/50; HTTP error appears as failure, not success; gallery toggle remains unchanged.
- [ ] Run current editor locally against isolated temp DB and observe controls absent (RED). Use current authenticated session; no auth bypass or new accounts. No persistent client edits in this step.
- [ ] Add focal state loaded/reset when payload changes, inline preview and native labeled controls beside existing Foto Utama media card. Use existing `apiError` and save/readback patterns; disable save while pending, verify readback before success/iframe refresh. Do not alter actual hero via global image selector. Hide or disable still-image adjustment when an active hero video replaces it, with clear explanation.
- [ ] Run `npm run build`. Expected: all three workspace builds pass. Re-run Task 1 tests. Expected: all pass.
- [ ] Exercise declared browser checks against temp DB, including simulated rejected save without server mutation. Expected: readback and reload match, no unrelated fields changed, failed save not reported successful. Restore slider values used by test.

### Task 3: Apply approved local content and verify client result

**Files:** No source files for client values. Use authenticated local admin UI/API; temporary DB snapshots and screenshots only for verification.

**Interfaces:** Consume existing couple PATCH, `shippingAddress` and Task 2 focal controls. Produce Riska-specific content updates; preserve all other current client data.

- [ ] Before writes, snapshot local DB with SQLite backup API to unique temporary folder, record relevant field baselines and hash original uploaded hero asset. If source differs from worktree, run tested feature server against snapshot first, then explicitly selected local DB only for scoped authorized content changes; do not seed on startup.
- [ ] Through authenticated admin, set each parent's existing name field to the client-approved name with `Bapak` / `Ibu`; PATCH only `{shippingAddress: clientApprovedDeliveryText}` for address prefixed `Kirim hadiah ke alamat ini:`. Exact private values remain in client conversation and local DB, not Git. Do not save entire invitation object or touch events/gallery/publication flags. Read back exact values.
- [ ] Preview current real hero with X=50, Y=0 as starting candidate; select Y that shows both faces within unchanged frame. Save via dedicated button and reload to prove persistence. Report chosen X/Y and any remaining crop limitation; no destructive edits to photo.
- [ ] Browser check at 390x844, 768x1024 and 1440x900: both parent lines appear correctly in profile and closing; gift address follows last account; focal CSS matches persisted values, hero frame dimensions unchanged from baseline at each width, no horizontal overflow or new media/console errors. Verify cover/avatar/gallery object-position styles unchanged and uploaded hero hash identical.
- [ ] Run `npm --workspace=apps/api test` and `npm run build`. Expected: all non-skipped tests pass and all builds pass; report skipped counts and any failures exactly.
- [ ] Request one fresh whole-diff review focused on correctness, React state, validation and template fidelity; fix important findings with failing regression first. No per-task review fan-out.
- [ ] Stop only preview processes created here, remove only owned temp test files (keep recovery snapshot until final validation succeeds), leave normal local server/user session intact. Report changes, chosen focal values, remaining limitations, and no deployment. Do not auto-commit or merge.
