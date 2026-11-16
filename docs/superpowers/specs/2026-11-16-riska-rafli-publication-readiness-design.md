# Riska & Rafli Publication Readiness Design

**Status:** Approved by user; implementation complete. **Date:** 2026-11-16

## Intent

Let super-admin finish the existing `yt-wedding` Riska & Rafli draft using dashboard fields and uploads, then publish deliberately when release requirements are met. Preserve `yt-wedding` presentation 1:1 and keep Anggi & Ivan unaffected.

## Current workflow and causes

- The public `/i/:slug` handler returns 404 when invitation row is absent or `isPublished=false`. This is intentional draft privacy, not a reason to bypass publication. After explicit publication, the same `/i/riska-rafli` route and SSR metadata path used by Anggi serve Riska's template.
- Seed creates an unpublished Riska invitation only when an existing `super_admin` exists. It currently creates no `couples` rows, while dashboard only edits existing couples and backend has no create-couple route. Therefore the gate's requirement for two profiles is impossible to complete in admin.
- Gallery upload exists under **Foto & Media**, and visibility exists under **Pengaturan YouTube**. For a new draft `yt_show_gallery` defaults true, so an empty gallery blocks publication immediately.
- User supplied `hero_bg.png`, `groom_avatar.png`, `bride_avatar.png` in `C:\Users\SCI-pc\Downloads\test_asset`. The first file contains JPEG bytes despite `.png` suffix. Upload code should normalize extension/MIME from verified magic bytes; files remain user-local until uploaded per invitation through admin.
- No production DB or live deployment has been inspected. If URL remains 404 after deployment, verify deployed commit, row existence, `isPublished`, and Nginx/API response using authorized read-only diagnostics.

## Approaches

1. **Idempotent seed of two blank role slots plus hide empty gallery by default — recommended.** Add only missing bride/groom rows for Riska; never overwrite any existing row. If gallery is empty and its setting absent, write `yt_show_gallery=false`; preserve explicit setting. Existing profile and gallery UI now completes publication requirements. Small change, reuses current workflow, no fabricated details.
2. Add general couple create/delete CRUD to API and UI. More extensible but unnecessary for this fixed two-profile source template; expands scope and risk.
3. Make draft route public or soften publication gate. Rejected: exposes incomplete/private invitation and contradicts approved release requirements.

## Design decisions

- Seed repair: whenever seed runs and Riska exists, ensure one bride and one groom row for that invitation if absent. New rows have empty `fullName`/`displayName` and nullable parents/photo. Deterministic IDs or role lookup prevent duplicates. Preserve all existing couple data and any existing gallery toggle. Create `yt_show_gallery=false` only when there are no gallery items and no prior field value. If no Riska row exists, existing super-admin-dependent draft creation logic stays; no dummy account or auto-publication.
- Admin workflow: use existing **Mempelai** fields and per-profile photo upload for each seeded slot. Use existing **Foto & Media → Tambah Foto** for gallery, then **Pengaturan YouTube → Tampilkan Bagian Galeri** when ready. Add contextual status/help only if needed to make blocked publication reason clear; do not redesign template page.
- Assets: do not auto-copy from Downloads or commit image binaries. Admin uploads each asset scoped to Riska invitation. MIME and extension follow verified bytes, so `hero_bg.png` stores as JPEG if its content is JPEG. Keep source photo/music rights and client consent as publication blockers until verified.
- Publication: keep strict current checks for two named profiles with owned photos, quote/copy, cover, valid event/date/map, and at least one owned gallery image if gallery enabled. Keep `/i/riska-rafli` 404 until super-admin explicitly publishes. Do not let seed, default settings or deployment flip `isPublished`.
- Deploy diagnosis: do not probe or mutate production from this change. Report read-only steps: check image/commit, seed logs, invitation row/slug/template/isPublished, API `/i` result, and Nginx proxy path. A DB draft is expected to return 404; missing row indicates seed failure/not run.
- Fidelity: no modifications to source template styling, HTML layout, font, animation, or artwork. Admin controls only; `CLAUDE.md` 1:1 rule remains binding.

## Goals and non-goals

**Goals:** Make the existing publication gate achievable through admin; make initial empty gallery state non-blocking without hiding an explicit admin choice; keep seed idempotent; preserve draft privacy and client isolation.

**Non-goals:** Invent client names/details, publish automatically, loosen release validation, add generic couple CRUD, import local media into Git, inspect/write production DB, or redesign the template.

## Validation

- Seed fresh Riska and verify exactly one bride/groom slot, both blank and unpublished; repeat seed and verify no duplicate rows or changed populated values.
- Existing explicit `yt_show_gallery` value survives seed. Empty gallery with absent setting gets hidden; uploaded image and admin toggle enable gallery; enabled empty gallery remains blocked.
- Existing editor can save both couple profiles and upload images; publication gate error reasons change after data is completed. Riska public route remains 404 until authorized publish; then `/i/riska-rafli` returns 200 and Riska metadata. Anggi data, API and production HTML remain unchanged.
- Run API tests, build, Anggi regression and release verifier in temporary DB. Do not inspect or mutate live DB; production 404 cause remains unverified until authorized operator checks deployment/DB read-only.
