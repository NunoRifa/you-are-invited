# yt-wedding Fidelity Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Track with checkboxes.

**Goal:** Reconstruct private yt-wedding HTML from original source so published presentation is 1:1 where verifiable, while keeping dynamic invitation data, approved Chara removals, and all release blockers.

**Architecture:** Rebuild private HTML from `D:\WinHTTrack\yt-wedding\chara.id\yt-wedding\index.html`; preserve the source CSS byte-for-byte and original DOM hierarchy/classes. Keep binder and project interactions as isolated JS; render only invitation-owned data and local approved assets. Use inert source fixtures for comparison; never execute captured source scripts.

**Tech Stack:** Existing Node.js, Hono, TypeScript, Drizzle, React/Vite admin, Tailwind CSS already installed, Vitest, available Playwright/browser tools. No new dependencies unless the existing environment cannot perform required screenshot comparison.

**Spec:** `docs/superpowers/specs/2026-11-17-yt-wedding-fidelity-design.md`

## Global Constraints

- `CLAUDE.md:3-9`: preserve source CSS, fonts, animations, ornaments, container markup, and layout; connect `PublicInvitationPayload` to matching text/link/image slots only.
- Never run scripts from `D:\WinHTTrack\yt-wedding\chara.id`; source tree is untrusted. Use scripts only after adapting into project-owned files and reviewing their behavior.
- Do not alter design tokens, CSS rules, font sizes, spacing, animation timings, layout, source wrappers, or icon geometry to “improve” design. Restored source custom CSS must match SHA-256 `50EB436A9EEB9806E64BD06D6917CA19E85F87A76354EC1A09CD418EB9B331C1`.
- Keep agreed removals: Chara attribution/CTA/tracking/challenge, broken Chara RSVP, fake QR/check-in, fake payment success. Keep source-shaped contribution shell truthful; decorative YouTube controls remain visible/inert.
- Keep fake hero progress/time decorative (original has still image, no video); music pulse/progress decorative; actual play/pause/close connected to audio gesture.
- Never fabricate client content or use unlicensed source media/fonts in deployed image. Missing rights, trademark, client-approved content, exact font binaries, or browser parity means leave Riska unpublished.
- `/i/riska-rafli` remains 404 until explicit authorized publication. Do not inspect/mutate production DB, deploy, or modify Anggi HTML/data.
- All verification must use disposable DB and isolated local static fixtures. Do not run original source scripts or external services.

## Review Focus

1. Every original section, order, IDs/classes/wrappers, and visible fixed UI survives reconstruction; tests compare original and converted static DOM inventories.
2. Original vs converted image/video/audio placement preserves dimensions, `object-fit`, crop, aspect ratio; test cover, couple portraits, gallery and audio shell using approved fixture assets.
3. Binder handles empty/malformed payload, long/untrusted guest name, invalid dates, zero/five gallery images without leaking sample data, breaking layout, or producing `NaN`.
4. No runtime requests to Chara, tracker/beacon, QR server or unapproved remote font/icon/media; source-font binaries absent, so release must stay blocked until local licensed assets verified.
5. Decorative controls are inert without fake feedback; real RSVP/Turnstile, comments, clipboard, maps, music and lightbox preserve source geometry and expected state.

---

### Task 1: Source Structure and CSS Restoration

**Files:** Modify `apps/api/private-pages/yt-wedding/index.html`, `assets/css/style.css`, `assets/css/tailwind.css`, `apps/api/private-pages/yt-wedding/tailwind.config.cjs`; add `apps/api/src/routes/yt-wedding-fidelity.test.ts`.

**Interfaces:** Private route contract remains `renderInvitationHtml(invitation, {isPreview})`; source links resolve via existing `/api/admin/invitations/:id/preview/assets/:file` and `/i/:slug/assets/:file`. No app route/data-schema changes. Preserve source order and DOM hierarchy. CSS `style.css` copied verbatim from `assets/css/style89cb.css`; Tailwind compiled from source config and source class tokens.

- [ ] RED: add static tests for ordered source sections/IDs and required classes (cover, header, chips, hero player chrome, couple, countdown, events, gallery, gift, closing, bottom nav, RSVP, comments, contribution shell, account sheet, music bar), source stylesheet SHA, and prohibited Chara/tracker/QR references.
- [ ] Run `npm --workspace=apps/api test -- yt-wedding-fidelity.test.ts`; expected failures on missing DOM/chrome/class parity or CSS hash.
- [ ] Rebuild `index.html` from source as a copied, reviewed document; remove only approved Chara/tracker/unsafe fake-submit elements and install local bundle links/minimal data hooks. Restore source fake progress/time and music pulse markup. Keep decorator controls visible but inert. Do not include original photos/audio in deploy until rights cleared.
- [ ] Keep `style.css` byte-identical; compile Tailwind with existing project dependency and source `tailwind.config.cjs`; verify icons/classes resolve. If exact font binary is missing/unlicensed, do not fake/swap it—record release blocker.
- [ ] Run focused test, `node scripts/test-yt-wedding.cjs`, full API tests and build. No commit in this step.

### Task 2: Safe Data Binder and Real Template Interactions

**Files:** Modify `apps/api/private-pages/yt-wedding/assets/js/bind.js`, `assets/js/app.js`, `assets/js/wk-anim.js` only if exact source behavior comparison proves extra animation; extend `apps/api/src/routes/yt-wedding-page.test.ts`.

**Interfaces:** Keep `bindYTWedding(root, payload, guestName, preview)` and published/draft fetch contracts unchanged. Bind content into original nodes using text nodes/`textContent`, validated same-invitation asset URLs and safe map URLs. Keep Turnstile/API contracts already implemented.

- [ ] RED: tests for source-styled quote/citation preservation, all headings/text/media slots, preview-only placeholders vs no published placeholders, escaped query, valid/invalid event date without `NaN`, gallery states 0/1/4/5, wishes DOM escaping/count, source wrapper classes preserved.
- [ ] Implement only missing data bindings; maintain exact source class/layout wrappers. Ensure visible section is source-identical when data exists. Add asset mapping from existing gallery records; broken source asset array paths must be replaced by actual invitation gallery payload in same image slots.
- [ ] RED/GREEN interaction tests for source-state fidelity: cover gesture controls audio and reveals player; play/pause/close icon state; inert subscribe/like/remix/download no fake state/network; decorative progress bars remain static; RSVP and wishes real API/Turnstile; gallery/lightbox counters; map/account copy; unavailable contribution no fake success.
- [ ] Compare `wk-anim` against actual referenced original sibling file read-only. Retain only if it matches source behavior; do not execute untrusted source file. Record parity gap if behavior cannot be established safely.
- [ ] Run focused tests, bundle integrity, full API tests and build.

### Task 3: Inert Source Reference and Browser Fidelity Validation

**Files:** Create `scripts/prepare-yt-wedding-reference.cjs` only if needed for a safe inert source copy; create/update `scripts/verify-yt-wedding-release.cjs`, `docs/superpowers/plans/2026-11-17-yt-wedding-fidelity-restoration.md`, and a QA results report under `.superpowers/sdd/` (git-ignored). No edits to original source directory.

**Interfaces:** Reference preparation reads explicit source file paths as data and writes only to OS temporary directory. It strips scripts, inline event attributes, trackers, remote URLs, iframe/embed; it never executes the source. Converted preview uses a disposable temporary SQLite DB and authenticated draft route. All visual captures use identical viewport, sanitized fixture content and approved local assets.

- [ ] RED: assert inert source output contains no runnable scripts/handlers/iframes/remote URLs; ensure test fixture and converted response carry same content/assets; release gate fails on unapproved fonts/media/trademark/content/browser-parity flags.
- [ ] Implement reference preparation with Node standard library only if this can sanitize safely; otherwise use a manual non-executable static reference and explicitly mark script-dependent states unverified.
- [ ] Browser compare at 1440x900, 768x1024, 390x844: capture original-static and converted page cover, every section, all sheets, nav, gallery, music, progress/time chrome. Compare screenshots/overlay and DOM bounding boxes; inspect console/network. No claim of 1:1 if approved matching assets/fonts or browser comparison unavailable.
- [ ] Test interactions using converted app only: valid guest input, malicious/long `?to=`, missing media, event date, gallery states, upload replacement, draft-owner authorization, published SSR metadata, Anggi regression. Do not hit production URLs/database.
- [ ] Run `npm --workspace=apps/api test`, `npm run build`, `node scripts/test-anggi-venue.cjs`, `node scripts/test-yt-wedding.cjs`, `node scripts/verify-yt-wedding-release.cjs`; expect release script non-zero while rights/content/font/trademark/browser gates remain open. Record full outputs and exact skipped checks.

## Completion / integration

- Review all static and browser diffs against original; document differences with file/viewport/state evidence. Fix only verified template-conversion differences that can be fixed without changing source appearance. Preserve unresolved blockers and keep draft unpublished.
- Stage only intended template/application/tests/docs files; do not include `.impeccable/hook.cache.json`, `.claude/`, `storage/`, local DBs or source mirror.
- Commit reviewed changes to `worktree-riska-rafli-yt-wedding-implementation`, push that branch, merge with `--no-ff` into local `master`, rerun tests/build on master. Do not push master or deploy. All outward actions limited to explicit branch push/local merge requested by user.
