# Riska & Rafli Publication Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Track steps with checkboxes.

**Goal:** Make existing Riska draft's two couple profiles and optional gallery manageable through admin, while preserving draft privacy and all existing client data.

**Architecture:** Make `seedTemplates()` idempotently ensure two blank bride/groom rows for an existing Riska invitation and hide gallery only when there are no gallery images and no explicit visibility value. Reuse existing admin profile/photo/gallery forms and publication gate; never auto-publish or import local files.

**Tech Stack:** Existing Node.js, TypeScript, Hono, Drizzle ORM, SQLite, React/Vite admin, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-16-riska-rafli-publication-readiness-design.md`

## Global Constraints

- `CLAUDE.md:3-9`: preserve template visual output 1:1; no CSS/layout/font/animation/decoration changes or redesign.
- Keep `/i/riska-rafli` 404 while unpublished; only authorized admin publishes after existing release checks.
- Seed blanks only; never invent client names/copy or overwrite existing populated couple/settings/gallery data.
- Gallery setting default changes only when no gallery images and no explicit `yt_show_gallery` field exist.
- Do not copy Downloads assets into repository/database automatically. User uploads assets per invitation through admin.
- Do not touch Anggi production HTML, client data, or unrelated local `.impeccable/hook.cache.json` / `.claude/` files.
- No production DB inspection/mutation or deployment during this task.
- User authorized commit, push to worktree branch, then merge to `master`; do not push `master` unless separately requested.

## Review Focus

1. Repeated seed must preserve already populated bride/groom records and not create duplicates.
2. Existing explicit gallery visibility (`true` or `false`) must survive seed; an empty gallery gets `false` only when no field exists.
3. Draft stays private after seed; normal `/i/riska-rafli` remains 404 until explicit publication.
4. Anggi couple/gallery data and published route remain unchanged.
5. Seed on DB with no Riska invitation or no super-admin must remain safe and not create a client account or public invitation.

---

### Task 1: Idempotent Couple Slots and Empty-Gallery Default

**Files:** Modify `apps/api/src/db/seed/templates.ts`; extend `apps/api/src/db/seed/yt-wedding.test.ts` and `apps/api/src/routes/invitation-draft.test.ts` only if needed for route regression.

**Interfaces:** Existing `seedTemplates(): Promise<void>`; no API/schema change. Ensure `couples` contains one `bride` and one `groom` for existing `riska-rafli`, each inserted only if role missing, with empty `fullName`, empty `displayName`, null parent/photo fields. Ensure `invitation_template_fields` has `yt_show_gallery=false` only when gallery is empty and field absent. Preserve explicit toggle and any existing gallery data. Never change `isPublished` from false.

- [x] Add failing tests: first seed creates exactly bride+groom with blank fields and hidden gallery; second seed creates no duplicates; preexisting populated couple row is byte-for-byte preserved and missing role alone is added; explicit gallery true/false is unchanged; gallery with photos and no visibility setting does not seed false; no Riska row or no super-admin creates no invite/client credentials.
- [x] Run `npm --workspace=apps/api test -- yt-wedding.test.ts`; confirm expected failures.
- [x] Implement minimal role-presence seed repair in Riska seed block. Use deterministic IDs (`c-riska-bride`, `c-riska-groom`) only for newly missing roles. Read existing setting before insert; never update existing setting.
- [x] Re-run focused tests, `npm --workspace=apps/api test`, `npm run build`, and `node scripts/test-anggi-venue.cjs`. Verify Riska public route remains 404 in test DB while unpublished.
- [x] Review `git diff --check`, stage only Task 1 source/tests and approved spec/plan docs; preserve unrelated files. Commit `fix(invitation): seed editable Riska couple slots`.
- [x] Push `worktree-riska-rafli-yt-wedding-implementation` to origin.
- [ ] Merge worktree branch into local `master` with `--no-ff`; run focused/full verification on master. Do not deploy or push `master`.

## Release/404 diagnostic (read-only, separate from implementation)

The public route's draft 404 is intentional. If 404 persists after the admin explicitly publishes, an authorized operator should inspect deployed commit/image, API/Nginx response, DB invitation row (`slug`, `template_key`, `is_published`) and seed logs using read-only access. Do not flip publication directly in SQL or disclose sensitive data. Live production deployment/DB are out of scope.
