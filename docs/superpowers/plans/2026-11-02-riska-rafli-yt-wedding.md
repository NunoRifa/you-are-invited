# Riska & Rafli yt-wedding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a separately managed, visually faithful `yt-wedding` invitation for Riska & Rafli as a protected, unpublished draft; enable publication only after actual client content, permitted assets, rights/trademark review, and visual verification are available.

**Architecture:** Keep vendor HTML/CSS structure and working motion, but replace platform scripts with a narrowly scoped DOM binder and existing invitation APIs. Add ownership-checked draft preview, admin template-specific controls, minimal persistence for RSVP channel/pax, and guarded publishing without changing Anggi & Ivan's production HTML or data. Template HTML for drafts must live outside Nginx/Vite public roots; uploaded draft assets must also require authenticated owner access.

**Tech Stack:** Existing Node 22, TypeScript, Hono, Drizzle ORM/better-sqlite3, Vite/React admin, Tailwind 3.4.16 build tooling, Vitest 5, Nginx and browser QA. No new dependency unless existing `qrcode` or platform/native features cannot supply a verified requirement; check first.

**Spec:** `docs/superpowers/specs/2026-11-02-riska-rafli-yt-wedding-design.md`

## Global Constraints

- `CLAUDE.md:3-9`: preserve original template's visible markup, classes, CSS, fonts, icons, typography, layout, transitions, and animations 1:1. No generic React redesign or blanket CSS fixes; optional empty sections may be hidden.
- Target URL `https://you-are-invited.my.id/i/riska-rafli`; draft public endpoint must return 404 until explicitly published.
- Missing client data/permission means no public sample names, dates, media, bank numbers or pretend counts; draft preview uses marked missing-data indicators.
- No production runtime dependency on `chara.id`; retain attribution if legally required, and block publication until rights/trademark checks complete. Do not ship source photos/audio/fonts publicly while rights unresolved.
- `?to=Nama+Tamu` is a display-only, escaped salutation; not guest verification or quota authority.
- Payment and check-in are not implemented; never claim success or issue QR for unverified attendance. Offline/online RSVP and pax are real persisted fields; online only with configured stream.
- Do not modify `apps/web/public/production/anggi-ivan/index.html`, Anggi's seeded records, uploaded assets, or existing template visual sources. Avoid `db:push` on live DB; use additive migrations with backup/rollback.
- **Do not commit or push without a separate explicit user request.** Skill's frequent-commit suggestion is superseded by this rule. For each task, record status and test evidence in working tree; stage/commit later only on instruction.

## Review Focus

1. Unpublished image/audio IDs requested through `/api/assets/:id` must not reveal draft files; test outsider, other owner, rightful owner, and super admin.
2. Anonymous `/templates/yt-wedding/index.html`, `/production/riska-rafli/`, `/i/yt-wedding`, dev Vite and built Nginx paths must not expose draft HTML or vendor sample data; test direct paths and route fallbacks.
3. Online RSVP without stream, malformed pax (`0`, `11`, decimals, strings), unknown attendance status and duplicate submission must reject without partial writes; add assertions to Task 4.
4. Admin PATCH carrying `ownerUserId`, `isPublished`, `templateKey`, foreign `assetId` or another invitation's nested ID must not bypass authorization or mutate Anggi; add assertions to Tasks 1, 2 and 5.
5. Broken gallery URLs, empty galleries, >4 pictures, long guest names, empty/malformed event dates, and missing network assets must not break lightbox, countdown, layout or security; add assertions to Tasks 7 and 8.

---

## File structure and dependency decisions

- `apps/api/src/routes/admin/authorization.ts` (new): `getAdminActor(cookieHeader): {id, role} | null` and `canManageInvitation(actor, invitation): boolean`. Call after session validation for every invitation-scoped admin action, including `admin/wishes.ts`; no new auth mechanism.
- `apps/api/src/routes/invitation-page.ts` and `apps/api/src/routes/invitations.ts`: published/draft route resolution, metadata and payload scoping; reuse one `loadPublicInvitation(slug, allowDraft = false)` function or equivalent rather than duplicate DB mapping.
- `apps/api/private-pages/yt-wedding/index.html` (new, no sample content) and `apps/api/private-pages/yt-wedding/assets/{css,js}/` (new, only cleared-for-use design resources): source-preserving markup/style plus `bind.js`. Resolve through explicit `INVITATION_PRIVATE_PAGE_DIR` in development/production; keep outside `apps/web/public`, `apps/web/dist`, Nginx static root. In `docker/Dockerfile.api`, copy only approved resources to backend image; unpublished template must not be build-copied into web image. Preview uses `GET /api/admin/invitations/:id/preview/assets/:file` with auth and strict asset allowlist; published `/i/:slug/assets/:file` uses same files only when invitation is published. CSS/JS must not contain client data. Missing proprietary dependencies block a faithful publish.
- `apps/api/src/routes/admin/invitations.ts`, `apps/api/src/routes/admin/wishes.ts`, `apps/api/src/routes/assets.ts`: scope reads/writes, validate uploads, template configuration, explicit publish. `apps/api/src/routes/admin/yt-wedding.ts` (new): typed, allowlisted settings if the existing invitation PATCH becomes too large; no arbitrary template-field writes.
- `apps/api/src/db/{schema,client}.ts` and `packages/shared-types/src/invitation.ts`: additive optional `wishes.attendance_channel` (`offline|online|null`) and `wishes.guest_count` (`integer`, default 1), plus `invitation_assets.kind='video'` at type level. Use existing invitation template fields for `yt_*` settings and approved asset IDs; no table for unused gift-tier/payment state.
- `apps/web/src/routes/admin/editor.tsx`: add `yt-wedding`-only panel or focused `apps/web/src/routes/admin/yt-wedding.tsx` component for source-specific fields and upload; retain existing tabs and Anggi-specific logic. `apps/web/src/routes/admin/index.tsx`: draft state, preview and publication state.
- `apps/api/src/db/seed/templates.ts`: insert `yt-wedding` catalog once and unpublished `riska-rafli` only if an existing super admin can own it. Never overwrite client data; no fabricated details.
- `apps/web/vite-plugin-invitation.ts`, `docker/nginx.conf`, `docker/Dockerfile.{web,api}`: close public static bypasses and proxy authenticated preview. Leave existing public template assets used by Anggi available.
- Tests adjacent to routes (`*.test.ts`) and a small `scripts/test-yt-wedding.cjs` runnable static/visual contract check; all tests use temporary SQLite and never real `storage/db/app.sqlite`.

## Task 1: Tenant ownership on every admin path

**Files:** Modify `apps/api/src/routes/admin/auth.ts:89-99`, `apps/api/src/index.ts:60-74`, `apps/api/src/routes/admin/invitations.ts:50-645`, `apps/api/src/routes/admin/wishes.ts:8-73`; create `apps/api/src/routes/admin/authorization.ts`, `apps/api/src/routes/admin/authorization.test.ts`.

**Interfaces:** Produce `getAdminActor(cookieHeader: string | undefined): AdminActor | null` and `canManageInvitation(actor: AdminActor, invitation: {ownerUserId: string | null}): boolean`. Super admin may manage any invitation; owner may manage only exact `ownerUserId` match; `null` owner is super-admin-only. Scope list as well as read, PATCH, events, gallery, couples, gifts, music, wishes, CSV and assets. Return 404 for foreign IDs (avoid enumerating), 401 for no session.

- [ ] Write failing route tests: owner A lists/views/edits only A; owner B cannot read/upload/delete A's record or wish or export; super admin can do both; null owner not visible to owner; forged `ownerUserId` and `templateKey` in generic PATCH do not change ownership/template; foreign asset and nested IDs cannot alter another client.
- [ ] Run `npm --workspace=apps/api test -- authorization.test.ts`; verify failures prove current cross-client access.
- [ ] Implement shared actor lookup/authorization and allowlisted PATCH fields, require invitation ownership at every nested route; verify gallery asset and couple photo IDs belong to target invitation before referencing them. Keep existing role semantics and Anggi behavior.
- [ ] Rerun targeted test and `npm run build`; both pass. Record evidence; no commit.

## Task 2: Draft isolation, preview and explicit publication

**Files:** Modify `apps/api/src/routes/invitation-page.ts:15-76`, `apps/api/src/routes/invitations.ts:10-22`, `apps/api/src/routes/assets.ts:10-54`, `apps/api/src/index.ts:52-75`, `apps/api/src/routes/admin/invitations.ts:492-645`, `apps/web/vite-plugin-invitation.ts:31-100`, `docker/nginx.conf:43-74`, `docker/Dockerfile.api:36-40`, `docker/Dockerfile.web:12-20`, `apps/web/src/routes/admin/{editor,index}.tsx`; create `apps/api/src/routes/invitation-draft.test.ts`.

**Interfaces:** `GET /api/admin/invitations/:id/preview` returns private HTML for authorized actor only, `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`; `GET /api/admin/invitations/:id/preview/data` returns the draft's typed invitation payload; `GET /api/admin/invitations/:id/preview/assets/:file` serves strictly allowlisted same-template CSS/JS/font/design assets to that actor. Published `/i/:slug/assets/:file` serves those assets only when published (no traversal). Regular `/i/:slug` and `/api/invitations/:slug` stay published-only. `PATCH /api/admin/invitations/:id/publication` takes `{isPublished: boolean, confirmation: string}`; only super admin may publish `riska-rafli` after required checks. `/api/assets/:id` requires owner/super-admin session when asset belongs to an unpublished invitation, and serves existing published images unchanged. Editor iframe uses preview URL for drafts.

- [ ] Write failing tests for unpublished public HTML/API/asset 404, outsider/other-owner preview and preview-asset denial, allowlisted CSS/JS delivery to owner/super-admin, traversal attempts rejected, published asset route scoped by slug, `?preview=` alone denial, `no-store`/`noindex`, normal Anggi public route/asset success, and publication cannot be toggled by generic PATCH or without explicit checks.
- [ ] Run `npm --workspace=apps/api test -- invitation-draft.test.ts`; confirm expected failures.
- [ ] Implement authenticated preview + draft payload with one invitation lookup/mapping; restrict private HTML to API-only path. Disable or redirect unsafe direct static `/production/*`, `/templates/*/index.html`, and build copies for new client; keep Anggi public routing working. Proxy preview/data/asset routes through Nginx; in Vite use API proxy for `/i`/preview or refuse unpublished slugs, never serve draft HTML from disk.
- [ ] Rerun test, `npm run build`, and probe Nginx/Vite direct paths against a **temporary** draft DB. Verify published Anggi remains reachable; no commit.

## Task 3: Seed only safe draft; stable metadata

**Files:** Modify `apps/api/src/db/seed/templates.ts:8-50` and seed tail, `apps/api/src/routes/invitation-page.ts:31-76`; create `apps/api/src/db/seed/yt-wedding.test.ts` and `apps/api/src/routes/invitation-page.yt-wedding.test.ts`.

**Interfaces:** `seedTemplates()` upserts only template metadata (`id: 'yt-wedding'`, `displayName: 'YT Wedding'`) and inserts `slug: 'riska-rafli'`, `templateKey: 'yt-wedding'`, `isPublished: false`, `ownerUserId: <existing super admin ID>` **only when absent**. If no super admin exists, do not create a client account or publish; emit an actionable setup error. Existing data survives repeated seed. Metadata of published invitations uses per-client data and a verified invitation-owned approved image; draft preview has no crawlable OG/canonical.

- [ ] Write tests: seed twice leaves existing Riska/Anggi rows and fields unchanged; no admin means no draft and explicit diagnostic; draft remains unpublished; published client HTML has correct escaped canonical/title/OG/Twitter, no Juliet/Romeo or Chara metadata.
- [ ] Run targeted tests; confirm fail on missing draft behavior.
- [ ] Implement narrow seed and metadata fallback (missing approved image means omit image, do not borrow another client asset); retain Anggi existing metadata contract.
- [ ] Rerun tests and `npm run build`; no commit.

## Task 4: Persist real RSVP channel and pax

**Files:** Modify `apps/api/src/db/{schema,client}.ts`, `packages/shared-types/src/invitation.ts`, `apps/api/src/routes/{wishes,invitations}.ts`, `apps/api/src/routes/admin/wishes.ts`; create `apps/api/src/routes/wishes.yt-wedding.test.ts`.

**Interfaces:** Add optional `CreateWishInput.attendanceChannel?: 'offline'|'online'` and `guestCount?: number`, `Wish.attendanceChannel?: 'offline'|'online'|null`, `Wish.guestCount?: number`. Add SQL columns to `wishes` via checked additive migration and defaults preserving existing rows (`attendance_channel NULL`, `guest_count INTEGER NOT NULL DEFAULT 1`). Keep `attendanceStatus` original three-way enum; online/offline both map to `attending`. For `yt-wedding`, require channel for attending, permit `online` only if valid stream URL is set; server accepts integer pax `1..10` offline, online and absent treated as 1; use same Turnstile/honeypot/rate limit as current endpoint. Only published invitations accept public POST/GET; public payload excludes hidden wishes and summary of hidden rows. Admin CSV adds channel and pax, escapes formulas as well as commas/quotes.

- [ ] Write failing tests: existing Anggi rows migrate without data loss and existing POST remains valid; yt offline/online/absent persist exact status/channel/pax; unknown status, online without stream, `0`, `11`, decimal/string pax and unpublished submission reject; hidden wish never leaks via payload; same-IP rapid resend remains blocked; CSV cannot execute user-supplied spreadsheet formulas.
- [ ] Run `npm --workspace=apps/api test -- wishes.yt-wedding.test.ts`; confirm fail; perform migration test on a copy of old schema, not live DB.
- [ ] Implement minimal schema, migration and route/type changes, preserve old payload for Anggi; use validated URL schemes for stream.
- [ ] Rerun tests and `npm run build`; no commit.

## Task 5: Media trust boundary and typed template settings

**Files:** Modify `apps/api/src/routes/admin/invitations.ts:133-227,295-328,492-645`, `apps/api/src/routes/assets.ts`, `apps/api/src/db/schema.ts`, `packages/shared-types/src/invitation.ts`; create `apps/api/src/routes/admin/yt-wedding.ts` only if focused settings handler needed and `apps/api/src/routes/admin/yt-wedding-settings.test.ts`.

**Interfaces:** `PATCH /api/admin/invitations/:id/yt-wedding` accepts explicit typed allowlist: `heroCaption`, `communityIntro`, `eventIntro`, `galleryIntro`, `giftIntro`, `musicLabel`, `shippingAddress`, `heroVideoAssetId`, `showGallery`, `showGift`; strings max 2000 chars, `heroVideoAssetId` only invitation-owned video, booleans strict. Store under `yt_*` keys in `invitation_template_fields`, and only for `templateKey='yt-wedding'`. Livestream URL uses existing `PATCH /:id/livestream` with HTTPS validation and owner scope, not duplicate template field. Video upload uses existing `/assets` API with `kind='video'` (MP4 only, verified container signature, max 20 MiB while no real client video size is known; increase only when needed with streaming handling). Image uploads verify PNG/JPEG/WebP signature, max 20 MiB and MIME; audio keeps prior validation. Replacement/deletion cannot affect another invitation or leave stale referenced asset; ensure failed upload does not remove prior file. Approved license status is a release checklist, not a guess from filename.

- [ ] Write failing settings/upload tests: authorized save/read-back reflected in payload, unsupported key/URL/foreign ID rejected, image disguised as `.png` rejected, oversize/wrong MIME video rejected, failure leaves old audio and gallery references intact, cross-client asset fetch prohibited for drafts, Anggi settings unchanged.
- [ ] Run `npm --workspace=apps/api test -- yt-wedding-settings.test.ts`; confirm expected fail.
- [ ] Implement typed handler and media validation, reuse current gallery/gift/audio mechanisms, update request-size limit only for video endpoint as necessary. No gift-tier schema or fake payment fields: captured non-empty state lacks reference.
- [ ] Rerun tests and build; no commit.

## Task 6: Admin controls, approval state and preview updates

**Files:** Modify `apps/web/src/routes/admin/{editor,index}.tsx`; create `apps/web/src/routes/admin/yt-wedding.tsx` if needed, `apps/api/src/routes/admin/yt-wedding-publication.test.ts`.

**Interfaces:** `YTWeddingSettings` reads/writes Task 5 settings only for `invitation.templateKey === 'yt-wedding'`. Reuse existing couple/event/gallery/gift/music controls, add hero-video upload, shipping/stream inputs and evidenced visibility switches; show validation errors and read-back after save. Draft `iframe` points to Task 2 preview, not public `/i/:slug`. Task 2 publication endpoint accepts `isPublished`, `confirmation` and, only for enabling yt-wedding, fresh `attestations: {assetsLicensed: true, youtubeIdentityReviewed: true, visualParityChecked: true, linksVerified: true}` from the super admin. Persist approval timestamp and current invitation `updatedAt` plus relevant asset/related-row revision in `yt_publication_approval` template field; if content/asset data changes, invalidate or reject stale approval on next publish. Check required real couple/event/media, non-placeholder maps/stream, approved source assets, and absence of fake payment/check-in action; refuse publish (422 with actionable reasons) while any gate unmet. Do not treat checkboxes as proof of legal rights: operator must actually verify; no generic PATCH bypass. Unpublish remains available. Owner may edit own invitation but cannot override release gates.

- [ ] Write failing publication tests: draft cannot be published with missing data, asset-rights/trademark/visual attestation or placeholder URLs; client edits invalidate relevant approval; generic PATCH cannot set `isPublished`; super admin action can publish only when checks pass; another owner cannot publish; unpublish immediate.
- [ ] Run `npm --workspace=apps/api test -- yt-wedding-publication.test.ts`; confirm fail.
- [ ] Implement small template-specific editor and backend gate; dashboard labels show Draft/Terbit; no default template soundtrack for Riska and no client-specific values in code. Keep Anggi editor layout and behavior unchanged.
- [ ] Rerun test and build. Manually verify save/read-back/preview and empty-state draft; no commit.

## Task 7: Faithful private HTML, bindings and real interactions

**Files:** Create `apps/api/private-pages/yt-wedding/index.html`, `apps/api/private-pages/yt-wedding/assets/js/{bind,app}.js`, `apps/api/private-pages/yt-wedding/assets/css/{style,wk-anim,tailwind}.css` as permission permits; modify `apps/api/src/routes/invitation-page.ts` for template URL/runtime configuration; create `scripts/test-yt-wedding.cjs` and `apps/api/src/routes/yt-wedding-page.test.ts`. Source references: `D:\Nuno\you-are-invited-template\yt-wedding\chara.id\yt-wedding\{index.html,assets/css/style89cb.css,assets/js/appbea6.js}` and shared animation files. **Never execute source scripts during audit.**

**Interfaces:** `bindYTWedding(root: Document, payload: PublicInvitationPayload, guestName: string, preview: boolean): void` (JS equivalent allowed) sets client strings using `textContent`, images by invitation-owned IDs, and links only after URL validation; no untrusted `innerHTML`. Startup obtains one authorized draft payload (Task 2) or published payload (Task 4), then binds before revealing content; on failure show a neutral unavailable state, never source sample HTML. Missing data markers appear only in authorized preview. Preserve existing CSS values/classes/DOM hierarchy, modal transitions, scroll reveal, bottom nav, gallery slide, audio-on-gesture; keep cover gate. Countdown parses ISO date/time in `Asia/Jakarta` deterministically (never `new Date('Minggu, ...T00:00:00')`). Unconfigured optional section hidden without rearranging visible section internals. Dynamically create first-four grid cells in original class/shape and derive count/lightbox array from same approved gallery list; zero images hides section.

- [ ] Write failing static/DOM route tests: private HTML contains no Juliet/Romeo, Chara URL, `/mulai`, fake metric, fake payment success, fake QR request or `preview-mode` fetch monkey patch; `?to=<img...>` renders as text; no broken `assets/index.html/img/`; zero/five images give 0/4+1 consistent thumbnail/counter behavior; missing event or invalid date never yields `NaN`; no clickable pseudo-video with no file; CSS/classes/animation selectors match captured source for visible elements.
- [ ] Run `npm --workspace=apps/api test -- yt-wedding-page.test.ts` and `node scripts/test-yt-wedding.cjs`; confirm they fail before code.
- [ ] Adapt a **copy** of source markup (not source files), preserve styling, and implement binder and interactions. Remove Chara CTA/footer and runtime trackers with function-by-function review. Preserve legally mandatory attribution if determined by license review; otherwise keep draft blocked. Bundle compiled Tailwind utilities with the identical config and inspect computed styles; acquire/verify missing icon fonts and Roboto **before** claiming parity. Do not copy unlicensed source media to public image; keep preview placeholder marked, drafts private.
- [ ] Rerun checks, `npm run build` and internal browser checks for controls/media/navigation; no commit.

## Task 8: Production-path regression and visual/release verification

**Files:** Create `scripts/verify-yt-wedding-release.cjs` for static/deployment assertions; extend `apps/api/src/routes/invitation-page.yt-wedding.test.ts`, `apps/api/src/routes/invitation-draft.test.ts`; modify only conversion-specific files when failures are proven. Keep a manual QA checklist in `docs/superpowers/plans/2026-11-02-riska-rafli-yt-wedding.md` task notes or `DEPLOY.md` if operational steps belong there.

**Interfaces:** Release check refuses publication/deployment of Riska assets absent approved rights, accepted trademark decision, actual client content and gallery/hero correctness; tests for `/i/riska-rafli` as draft remain 404. No automatic deploy. A change of `isPublished` after all gates must serve initial-HTML Riska metadata and proper client content without leaking draft data to others.

- [ ] Write failing regression tests for Anggi page/API/editor smoke, initial metadata and cover image of two published clients, normalized internal asset URLs, blocked direct static paths, safe guest query, and absence of `chara.id`, Cloudflare tracking and QR server requests in new build. Run tests to confirm baseline gaps.
- [ ] Implement only required fixes; then run `npm --workspace=apps/api test`, `npm run build`, `node scripts/test-anggi-venue.cjs`, `node scripts/verify-client-revisions.cjs`, `node scripts/verify-yt-wedding-release.cjs` with a **temporary** seeded DB. Record full outputs including any existing failures; no test against live DB without backup.
- [ ] Browser QA: same permitted images/text in local source and conversion; desktop 1440×900, tablet 768×1024, mobile 390×844; capture cover, each visible section, RSVP/wishes/gift/gallery modals, countdown, music and scroll reveal. Compare geometry/fonts/colors/animation against source; inspect console/network for 404 and external hosts. Test `?to=Nama+Tamu`, long/untrusted names, asset upload replacements, owner/super-admin/draft/published routes and WhatsApp preview from first HTML response. Distinguish source bugs from integration regressions.
- [ ] Report changed files, migration and backup/rollback, precise test results, remaining missing client content/media/rights/trademark, and explicit publication status. With current facts, **leave `riska-rafli` unpublished** and do not claim production-ready or public availability. No commit or deployment without user's subsequent instruction.

Manual QA pending approved media/content and source parity: compare local source and converted page with identical licensed images/text at 1440×900, 768×1024 and 390×844. Capture cover, every visible section, RSVP/wishes/gift/gallery modals, countdown, music and scroll reveal; compare geometry, fonts, color and motion. Inspect console/network for missing assets and external hosts. Test guest query (`?to=Nama+Tamu`, long/untrusted input), upload replacements, owner/super-admin/draft/published routes and first-response WhatsApp metadata. Record source defects separately from integration defects. No visual parity claim until this runs.

## Execution handoff

Tasks 1–2 secure shared tenant/draft paths first; Tasks 3–6 add isolated data/admin capabilities; Task 7 converts and binds source; Task 8 proves fidelity/regressions. Use TDD per task. Before touching code, executor re-read spec, current tree, and source files; never assume a previous session's artifacts exist or that production DB is disposable. If media rights, source non-empty wishlist markup or trademark clearance remain unknown, document blockers instead of fabricating features or quietly altering template. Once plan reviewed, choose native execution for fewer handoffs; choose subagent-driven only if independent per-task review is desired.
