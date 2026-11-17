# yt-wedding 1:1 Fidelity Restoration Design

**Status:** Proposed, awaiting written-design approval. **Date:** 2026-11-17. **Visual source of truth:** `D:\WinHTTrack\yt-wedding\chara.id\yt-wedding\index.html` plus referenced source CSS/assets. **Target:** existing private bundle `apps/api/private-pages/yt-wedding/`, used by Riska & Rafli.

## Intent and agreed direction

Restore the current converted template to 1:1 visible fidelity with original `yt-wedding`; keep invitation payload dynamic, retain existing admin/backend and prevent runtime dependency on Chara. Rebuild private HTML structure directly from source instead of patching reduced conversion.

User agreed: original source is design authority. Preserve original visual elements, including YouTube identity while in internal fidelity preview. Remove Chara attribution/CTA/tracking and Chara service dependencies already agreed earlier. Decorative YouTube-style Subscribe/Like/Dislike/Remix/Download controls remain visually present, but remain inert: no fake state, counts, toast, or network calls. Functional invitation controls continue to operate through project services. No template redesign.

## Verified evidence

- Project rule `CLAUDE.md:3-9`: preserve source CSS, fonts, animations, ornaments, container structure, and layout; only connect `PublicInvitationPayload` into matching text/link/image slots.
- Original `index.html` has 1,074 lines; private converted page has 799. Source `style89cb.css` and converted `style.css` have identical SHA-256 `50EB436A9EEB9806E64BD06D6917CA19E85F87A76354EC1A09CD418EB9B331C1`. Main custom CSS is not itself divergent; missing/altered HTML, generated Tailwind rules, runtime behavior and assets explain confirmed visual differences.
- Original hero is still-image cover with decorative player progress and `1:24 / 4:05` time, not a playable video. Music bar contains decorative animated pulse bar and real play/pause/close affordances for background audio.
- Source mirror includes `hero_bg.png` (actual JPEG bytes), `groom_avatar.png`, `bride_avatar.png`, and `bg-music5e1f.mp3`. Font Awesome stylesheet mirror exists; referenced `webfonts/` binaries and Roboto font files are absent. No asset-specific rights evidence exists. Source gallery paths include broken `assets/index.html/img/...`; `assets/index.html` is captured 403 page.
- Current conversion substitutes a 1x1 GIF for photos, has empty audio source, omits fake progress/time and music pulse, and changes/removes some copy/actions. It adds `wk-anim.js/css`; original `index.html` has no `data-wk-anim` attributes and the referenced sibling animator is outside the captured theme folder. Whether that animator adds extra entrance motion must be checked against the source page's actual available sibling file and rendered result.
- Source contains inline click handlers and external dependencies. It must never be run as supplied. A static visual reference can be produced from an isolated temporary copy with scripts, event attributes, iframes, remote loads, and tracker nodes disabled/removed; CSS/layout and licensed local assets remain. Converted page interactions are tested separately with the actual project backend on a disposable DB.
- No browser screenshot or production image/container inspection has yet established live parity. Riska remains unpublished. The initial production `/i/riska-rafli/` returned “Invitation template not available”; Docker API image was fixed to copy private template, but actual deployed image has not been verified.

## Approaches considered

1. **Reconstruct private HTML from original source — recommended and agreed.** Copy original section order, DOM hierarchy, classes, inline styling and content slots, then add minimal safe binding hooks. This makes source comparison auditable and avoids patching hundreds of missing lines in the reduced output.
2. Incrementally patch current converted HTML. Smaller immediate diff but makes omissions and source parity harder to enumerate; rejected.
3. Rebuild sections with React or redesign to emulate screenshot. Rejected outright by `CLAUDE.md` and user request.

## Design scope

1. Restore all captured sections in source order: cover; YouTube header and filter chips; hero with original static progress/time chrome; couple/community post; countdown; event cards; gallery preview/lightbox; gift/tier empty state; closing; bottom navigation; RSVP, comments, contribution and account sheets; background audio and floating music bar.
2. Copy original custom CSS byte-for-byte. Preserve source HTML element hierarchy, classes, IDs, inline styles, dimensions, layout, spacing, typography, colors, gradients, responsive behavior, transitions and animation semantics. Generated Tailwind utility output must be built from the source config and compared by computed style to original utility behavior. No new style declarations to compensate for markup changes.
3. Rebind names, lineage, quote, event/time/location, photos, gallery, gifts, audio, wishes, counters and guest `?to=` to original source nodes using safe text nodes/`textContent` and validated invitation-scoped asset URLs. Dynamic data must preserve child spans such as the quote citation and keep image dimensions/crop/wrappers. Preview-only `[Belum diisi]` markers must not ship in public rendering.
4. Preserve fake video progress/time as visibly decorative, not as real video or playback status. Preserve music pulse/progress decoration; connect original play/pause/stop control affordances to actual audio, with user-gesture start. When no approved audio exists, retain original bar layout but don't claim playback.
5. Keep decorative Subscribe/Like/Dislike/Remix/Download controls pixel-faithful but inert. Preserve visual appearance and focus geometry; set accessible disabled semantics or no-op handlers without visual styling changes. No fabricated statistics or confirmations.
6. Continue approved changes: remove only Chara branding/CTA, tracking/challenge and broken Chara endpoints; do not remove required legal attribution without evidence. No fake QR/check-in, no fake payment success. Keep contribution sheet geometry with truthful unavailable behavior. RSVP uses real wishes API and Turnstile.
7. All runtime dependencies/assets local to project/private template or existing local project dependency. No `chara.id` requests. Tailwind utilities compile using installed project Tailwind; Font Awesome/Roboto binaries need exact family/version and rights verification. Source mirror confirms Font Awesome Free CSS header states Icons CC BY 4.0, Fonts SIL OFL 1.1, Code MIT; source does not include font binaries. Do not assume the separate project Font Awesome binaries match this exact version. Google Roboto binary must be independently verified and licensed before mirroring.
8. Original image/audio files remain outside deployment until rights are documented. Do not substitute arbitrary images or fonts. If exact visual assets cannot be used, document differences and retain draft. YouTube mark/trademark remains in internal fidelity preview only pending clearance.

## Dynamic/control mapping

- Couple profile cards map only existing `bride` and `groom` records; blank values show placeholders only in authorized preview. Cover/hero/couple/closing image positions retain original aspect and `object-fit` rules.
- Events map to source Akad/Resepsi cards and date/time/venue/maps links. Invalid/missing events do not render fake date/address; optional cards hide only when empty, with no visual changes to remaining cards.
- Gallery uses one ordered, invitation-owned media list for first four preview cells, `+N`, lightbox counter and next/previous navigation. Empty optional gallery hides publicly and shows explicit preview empty state; preserves original CSS/markup structure for non-empty state.
- Original `<audio>` and player shell use approved `musicUrl`; stop/pause is real. Original music progress/pulse remains decorative, like source.
- Guest wishes are created by DOM APIs (no untrusted `innerHTML`); hide empty copy only once actual wishes arrive.

## Non-goals

No new brand identity, CSS/accessibility restyling, section redesign, React rewrite, made-up data, copied private media, payment/check-in integration, direct DB edits, auto-publication, or deployment. No claim of 1:1 until same licensed source appearance can be compared in the browser.

## Validation design

1. Static: DOM section order and class/ID inventory vs original; CSS source hash preserved; computed Tailwind class mapping; list every intentional node removal/addition and reason. Confirm source CSS and original section wrappers survive binding.
2. Safe source reference: build a temporary inert copy of source markup. Disable JavaScript, remove inline handlers, iframe/embed, external stylesheet/font/script/tracker requests. Serve only exact licensed/local CSS and image files from a temporary static origin, never execute downloaded code. Compare source initial/static state. Where source appearance requires script behavior, implement trusted test-only minimal control stimuli or report non-verifiable; never evaluate the captured vendor scripts.
3. Converted page: disposable SQLite fixture with matched client content and approved asset bytes; use local API/private preview. Capture same 1440×900, 768×1024 and 390×844 viewports, same fixture media and scroll positions. Compare cover, every section, gallery states 0/1/4/5, modal/sheets, navigation, fake player chrome, music bar, overlays and overflow using screenshots and computed geometry.
4. Interaction: cover gesture/audio affordances; decorative controls are inert; RSVP/Tu rnstile responses; wish list; maps URL; gift clipboard; gallery; countdown with valid/missing dates; guest query injection; owner/super-admin draft isolation; no Chara/QR-server/tracker/unauthorized remote requests. No live production DB or server.
5. Regression/build: full API suite, workspace build, bundle integrity, Anggi route/venue tests, draft public 404, authenticated preview works. Verify private assets are in production API image via built image inspection when Docker daemon is available. Do not deploy.

## Release gates / unresolved facts

- Legal authorization for original three photos/audio and YouTube brand has not been supplied. Hold public release until verified. Keep these assets local/private until cleared.
- Roboto and exact Font Awesome 6.5.1 binaries are absent from source mirror; exact-version licensed local binaries are needed for zero external asset requests.
- Source snapshot has no non-empty comments/contribution/payment states. Cannot claim 1:1 for uncaptured populated variants; no fake success.
- Browser/mobile visual parity and live API image packaging are unverified; a Docker daemon was unavailable previously. Do not say production-ready or publish until these are verified.
