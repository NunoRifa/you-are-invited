# Investigation Plan: Production Music Upload Returns 413 / 415

## 1. Root Cause Analysis

### Confirmed from repository
- Music and image uploads share one endpoint: `POST /api/admin/invitations/:id/assets` in `apps/api/src/routes/admin/invitations.ts`.
- Browser sends `multipart/form-data` using `FormData` in `apps/web/src/routes/admin/editor.tsx`; no base64 conversion.
- Frontend file picker accepts `audio/*,.mp3,.m4a,.wav,.ogg`, but current code has no file-size validation or specific handling of HTTP 413. Errors are generic.
- Backend uses Hono `c.req.parseBody()` and currently has no explicit endpoint-specific file-size, MIME, or extension limit.
- Production project documents say Nginx Alpine is the web container/reverse proxy: `DEPLOY.md`, `docker-compose.yml`, `docker/nginx.conf`. `/api/` is proxied from Nginx to API container.
- `docker/nginx.conf` currently sets no `client_max_body_size` in server or `/api/` location.
- No `LimitRequestBody`, app body-limit middleware, or CSP configuration was found in tracked source/config files searched.
- Backend upload replacement currently deletes existing audio records/files **before** reading and writing the new audio. Therefore a later disk/DB failure can lose the previous working custom music.
- Docker API process runs `node apps/api/dist/index.js`, with persistent storage mounted at `/app/storage` (`docker/Dockerfile.api`, `docker-compose.yml`).

### Evidence from user's production browser
- Music upload POST receives HTTP `413 Content Too Large`.
- This confirms rejection due to request size at some HTTP layer but does **not** identify which layer. No production response headers/body, proxy error log, running config, or Cloudflare request trace supplied yet.

### Not confirmed
- Whether 413 originates from production Nginx, Cloudflare/proxy in front of it, hosting layer, or API. Repository Nginx config lacks explicit body limit, but an unconfigured Nginx commonly has a default `client_max_body_size` of 1 MiB; this is a plausible explanation, not yet proven to be the live server's effective configuration.
- Whether production currently runs exact committed `docker/nginx.conf`/image or has server-side overrides.
- Exact size of the audio file that triggered 413.
- Source of the report-only CSP header. No CSP configuration appears in tracked app/reverse-proxy source; it may be injected by hosting, Cloudflare, or browser extension/security tooling. Report-only CSP is not enforced and browser output says the POST proceeded to receive 413, so there is no evidence that CSP caused this failure.
- `setTimeout handler took 55–63ms` is browser performance instrumentation, not evidence for request rejection.

## 2. Local vs Production Differences

- Local API runs through `tsx watch src/index.ts`; requests reach Hono through local Vite proxy or direct API port, with no production Nginx upload limit in that path.
- Production deployment uses Docker: Nginx `web` reverse-proxies `/api/` to Hono `api`. Proxy/request-body limits can differ from local even though application route and multipart upload are the same.
- No configured application upload-size limit currently exists, so local may accept substantially larger files than production proxy permits.
- No secret environment values are needed to test the size limit. Only whether an outer CDN/proxy is enabled and non-sensitive response headers are needed if local configuration cannot establish the responding layer.

## 3. HTTP 413 Investigation

1. Inspect the failing request in DevTools: request payload size, response headers/body, `Server`, `Via`, `CF-Ray` if present, and any response-specific proxy marker. Do not share cookies/session tokens.
2. Inspect the active production web container config and logs, without changing it:
   - `nginx -T` inside the running `web` container for the effective `client_max_body_size` and included files.
   - Nginx access/error logs at the request timestamp; Nginx error typically identifies body-size rejection.
   - API logs around same timestamp. If API has no request, rejection occurred upstream; if it logs and returns 413, inspect app/runtime behavior.
3. Check whether DNS/proxy provider (for example Cloudflare) fronts Nginx using response headers and current operator configuration. Do not infer provider based only on domain or deploy guide.
4. Compare live image/config version with repository `docker/nginx.conf` and deployment commit.
5. Confirm actual audio file size and repeat with controlled sizes to establish threshold and rejecting layer.

## 4. CSP Analysis

- Browser reports `Content-Security-Policy-Report-Only` with `connect-src 'none'`; report-only logs violations but does not block the POST.
- The request receives HTTP 413, making size enforcement the priority. Treat CSP as separate configuration issue unless response/header evidence shows otherwise.
- Locate policy source via production response headers, browser DevTools initiator/response data, active Nginx config, hosting/CDN configuration. Current repository search found no configured CSP directive.
- If repo/config turns out to own this header, narrowly set `connect-src 'self'` for same-origin API requests; retain existing other directives and keep report-only/enforced modes intentionally configured. Do not add a broad `*` source.

## 5. Recommended Fix (Pending 413 Layer Evidence)

Recommended design: apply a dedicated audio-upload maximum, not a global API limit. Set one documented bound (proposed **20 MiB per audio file**) consistently in Dashboard and backend; account for multipart overhead at the proxy. Use a slightly larger request bound only on `/api/admin/invitations/:id/assets` (proposed **21 MiB**) if Nginx is confirmed as the rejecting layer. Validate extension/MIME/size before modifying active asset state. Stage and fully write the new asset first, insert/commit DB state, then remove prior custom audio only after success. On failed upload keep old song active and return a clear message.

The 20 MiB threshold is a proposed product limit, not a requirement confirmed from existing code. If business needs require larger audio, decide before implementation; do not silently raise a global proxy/API limit.

If external proxy/CDN enforces a lower limit, configure its endpoint/request-size rule or route accordingly; a local repo change alone will not resolve that outer cap. If Nginx is the rejecting layer, set `client_max_body_size` only inside `/api/admin/invitations/` assets location or a dedicated exact endpoint location, not server-wide. Preserve auth/session middleware and all other API limits.

## 6. Affected Files (after approval/evidence)

Likely code/config changes:
- `apps/web/src/routes/admin/editor.tsx`: audio size/type validation before network, user-facing over-limit and HTTP 413 messages; do not affect image uploads.
- `apps/api/src/routes/admin/invitations.ts`: endpoint-specific validation and safe replacement lifecycle; preserve previous audio until new file/DB write succeeds.
- `docker/nginx.conf`: only if live Nginx is confirmed to return 413; add scoped request limit for upload endpoint, with multipart overhead.
- `apps/api` tests: test accepted size, over-limit, unsupported type, replacement preservation on failure, and image-upload compatibility.
- `PLAN.md`: this investigation and recommended staged fix.

No migration is expected; existing `invitation_assets` schema suffices.

## 7. Deployment Requirements

- No production deployment/config changes before approval.
- If Nginx is confirmed: ship scoped Nginx config, validate with `nginx -t`, rebuild/reload web container using normal deployment process.
- If CDN/hosting is confirmed as limiter: operator must update that layer's per-route limit; source code deployment alone is insufficient.
- Deploy API + web together for aligned limits and user-facing messages. No upload should delete old audio before new file is safely stored.
- No secrets/environment values need to be added or exposed.

## 8. Testing & Verification Plan

- Unit/integration test valid MP3 upload below bound succeeds.
- Upload at or near allowed bound succeeds, with multipart overhead handled.
- Upload above bound returns clear 413/400 response before storage or DB mutation.
- Unsupported extension/MIME rejected before replacing active song.
- Replace an existing song with a valid new song; only new song becomes active after successful persistence.
- Force file-write or DB failure; previous song record/file remains active and readable.
- Image upload remains unaffected by audio-specific validation/limit.
- API test checks saved asset can be read and response MIME matches uploaded type.
- Production verification: use test audio sizes around the configured bound; compare Nginx/API logs and response headers; confirm 413 source is resolved.
- CSP report-only warning is tracked separately; verify same-origin API directive only if policy is within owned config.
- Ignore 55–63ms timer warning unless separate profiling shows user-visible issue.

---

## 9. Implementation Status (2026-10-14)

User approved the 20 MiB per-audio-file limit and scoped 21 MiB upload-request limit for the existing shared assets endpoint. Production workflow must remain Docker Compose + Nginx + API; no production deploy or runtime restart was performed during local code changes.

### Implemented locally
- `apps/web/src/routes/admin/editor.tsx`: client-side audio extension/MIME and 20 MiB size checks; clear messages for oversized audio, unsupported format, and API 413/415 responses.
- `apps/api/src/routes/admin/invitations.ts`: server-side audio size/MIME/extension/header-signature checks; new file is written to the existing persistent `storage/uploads` directory, then asset insert and prior-audio deletion occur in one SQLite transaction. A failed write/transaction removes the new file and preserves old audio records/files. No duplicate writes outside the production Docker volume.
- `apps/api/src/index.ts`: Hono `bodyLimit` scoped to `/api/admin/invitations/:id/assets` at 21 MiB, with JSON error response.
- `docker/nginx.conf`: scoped `client_max_body_size 21m` to matching admin asset-upload URI; other API paths remain under existing defaults.

### Pending verification
- API and web builds pass. Focused upload regression tests and full API suite pass, but production endpoint still needs live validation.
- Nginx syntax/runtime behavior has not yet been validated against the production host.
- Production 413 origin remains unconfirmed until effective live Nginx/CDN configuration and request logs are inspected.
- Report-only CSP source remains unknown; it is separate from the observed 413 unless further evidence links them.
- No production deployment, Nginx reload, or database migration performed.

### Production rollout after tests and review
1. Build/test locally; validate Nginx config using the project/deployment-compatible Nginx binary/container.
2. Deploy API and Nginx image/config through the existing Docker Compose workflow.
3. Verify at the production edge using test files below, near, and above 20 MiB; inspect response headers and both Nginx/API logs.
4. Confirm old custom music remains active after rejected/failed replacement and image gallery uploads remain functional.
5. Diagnose and remediate report-only CSP only after identifying its actual header source; keep `connect-src` same-origin if application-owned.

No schema migration or new environment secret is expected.

---

## 10. Findings / Test Results

(To be filled in after the local build, API tests, Nginx config validation, and production-edge checks are actually run. Do not mark any unrun check as passed.)

| Check | Result | Evidence |
|---|---|---|
| API build | Passed | `npm run build --workspace=@you-are-invited/api` |
| Web build | Passed | `npm run build --workspace=@you-are-invited/web` |
| Full API suite | Passed, 5 live tests skipped | Vitest: 29 passed / 5 skipped |
| API tests: upload validation and replacement | Passed | `assets-upload.test.ts`: normal audio, invalid MIME/extension/content, above 20 MiB, near 20 MiB, 21 MiB multipart rejection, replacement, old-file preservation on rejected upload and simulated disk-write failure, image upload. DB transaction failure not yet simulated. |
| Nginx config syntax | Pending | Local Docker/Nginx invocation unavailable; run `docker compose exec web nginx -t` against production config before rollout |
| Production request-size origin | Pending | Production response headers and logs required |
| Production upload checks | Pending | Deploy and test required |
| CSP header source | Pending | Production response headers / hosting config required |
## 11. Production Audio Upload — HTTP 415 Investigation & Resolution (2026-10-14)

### 1. Ringkasan Masalah dan Kronologi
1. Awalnya upload MP3 berhasil secara lokal, namun gagal di production dengan HTTP 413 (Content Too Large) akibat batas default Nginx (1 MiB).
2. Perbaikan HTTP 413 diterapkan (scoped Nginx `client_max_body_size 21m`, Hono `bodyLimit 21m`, dan validasi MIME/ekstensi 20 MiB).
3. Setelah deploy ulang ke production, file MP3 klien `KUSUMA_WIJAYA_PAWESTRI.mp3` (~4 MB) gagal dengan HTTP 415 (Unsupported Media Type).

### 2. Hasil Investigasi Frontend & Backend
- **Frontend**: Pada `apps/web/src/routes/admin/editor.tsx`, daftar MIME audio sebelumnya terlalu sempit (`audio/mpeg`, `audio/mp3`) dan menolak MIME type yang dikirimkan oleh browser Windows/browser tertentu (`application/octet-stream` atau `audio/x-mpeg`). Pesan error HTTP 415 juga dipetakan secara generik tanpa menampilkan alasan spesifik dari server.
- **Backend**: Pada `apps/api/src/routes/admin/invitations.ts`, pengecekan file signature audio sebelumnya hanya menerima `ID3` persis di byte 0 atau MPEG sync word persis di 2 byte pertama (`bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0`). File MP3 yang diawali dengan metadata ID3v2 tag non-standar, padding, atau ID3v1 tag di akhir file mengalami *false negative* dan ditolak dengan status 415.

### 3. Root Cause Terkonfirmasi
1. **Validasi Signature Terlalu Kaku**: Pengecekan magic byte MP3 hanya memeriksa 2-3 byte pertama tanpa melakukan pemindaian MPEG sync word (`0xFFE`/`0xFFF`) pada buffer awal (hingga 8 KiB) dan tanpa memeriksa penanda `TAG` (ID3v1) di akhir file.
2. **Inkonsistensi MIME Type Antar-Platform**: Windows Chromium/browser sering mengirimkan MIME `application/octet-stream` atau `audio/x-mpeg` untuk file audio tertentu, yang sebelumnya langsung ditolak oleh backend sebelum memeriksa konten file.

### 4. Perbaikan yang Telah Diimplementasikan
1. **Peningkatan Deteksi MP3 (`apps/api/src/routes/admin/invitations.ts`)**:
   - Pengecekan header `ID3v2` di byte awal.
   - Pemindaian frame sync MPEG (`0xFF` diikuti bit `111` dengan validasi MPEG layer valid) dalam 8192 byte pertama.
   - Pengecekan tag `ID3v1` (`TAG`) pada 128 byte terakhir file.
   - Pengecekan signature tetap menolak file non-audio (misal file text/executable yang di-rename menjadi `.mp3`).
2. **Toleransi MIME Standar & Spesifik**:
   - Menambahkan variasi MIME type sah untuk MP3 (`audio/mpeg`, `audio/mp3`, `audio/x-mpeg`, `audio/x-mp3`) serta mengizinkan `application/octet-stream` jika ekstensi adalah audio sah dan file signature valid.
   - Menambahkan kode error terstruktur (`unsupported_audio_mime`, `invalid_audio_signature`).
3. **Penyempurnaan Error Message di Admin Dashboard (`apps/web/src/routes/admin/editor.tsx`)**:
   - Menampilkan detail pesan error spesifik jika server mengembalikan `unsupported_audio_mime` atau `invalid_audio_signature`.
4. **Pengujian Regresi**:
   - Menambahkan pengujian otomatis di `apps/api/src/routes/admin/assets-upload.test.ts` untuk memvalidasi:
     - MP3 dengan header `ID3v2`.
     - MP3 murni dengan MPEG frame sync (tanpa ID3).
     - MP3 yang dikirim dengan MIME `application/octet-stream`.
     - Penolakan file teks/biner palsu yang di-rename menjadi `.mp3`.
     - Penolakan file melebihi batas 20 MiB.
     - Keutuhan file audio lama jika upload gagal (disk failure / validation failure).

### 5. Hasil Uji Lokal
- `npm run test --workspace=@you-are-invited/api`: **30 passed, 5 skipped (Turnstile live tests)**.
- `npm run build --workspace=@you-are-invited/api`: **Sukses**.
- `npm run build --workspace=@you-are-invited/web`: **Sukses**.

---

## 12. Mobile Gallery Lightbox — Responsive Image & Close Button Fix

### 1. Ringkasan Masalah
Pada perangkat mobile klien melaporkan foto preview terlalu zoom/terpotong, tidak menyesuaikan viewport, dan sulit/tidak dapat ditutup. Target: tampilkan foto utuh dengan rasio asli, tombol X mudah disentuh, close/backdrop/Escape berfungsi, dan pulihkan scroll; jangan mengubah tampilan desktop, gallery sebelum dibuka, gallery upload/data, atau klien lain.

### 2. Implementasi Sekarang (fakta terverifikasi)
- Section gallery memuat widget Elementor `data-id="b6f6ff8"`; foto API ditambahkan ke `.elementor-gallery__container` pada `apps/web/public/production/anggi-ivan/index.html:7250–7284`.
- Lightbox dinamis adalah implementasi **custom vanilla JS** `setupGalleryLightbox(items)` pada file yang sama, sekitar `7184–7248`. Ia membuat `#standalone-lightbox`, `#lg-main-img`, `#lg-close-btn`, prev/next, caption/counter. Klik foto mencegah navigasi URL lalu memanggil `window.openGalleryLightbox(idx)` (`7257–7267`). CSS/layout legacy Elementor/lightbox masih ada, tetapi itu bukan modal yang ditemukan aktif pada local browser check.
- CSS lightbox scoped pada file tersebut sekitar `578–676`: modal `position:fixed; inset:0`, image `max-width:100%; max-height:80vh; object-fit:contain`, close `40×40px; top:20px; right:20px`, nav `44×44px`. Thumbnail memakai `cover` dan hover scale di `.elementor-element-b6f6ff8` (`536–575`); selector ini tidak menargetkan `#lg-main-img`.
- Close handler saat ini menghapus `.active` lalu mengosongkan `document.body.style.overflow` (`7217–7220`); open mengeset `hidden` (`7242–7246`). Backdrop click hanya menutup bila target adalah modal (`7225`); tombol X memakai `onclick` (`7222`); Escape/arrows ditangani di document (`7227–7232`); swipe dipantau di seluruh modal (`7234–7240`).
- Ada template-wide rule `img { pointer-events:none !important }` (`index.html:2169–2172`); potensi pengaruhnya ke touch/interaksi image perlu diperiksa, belum terbukti sebagai penyebab close.
- HTML memuat viewport meta `width=device-width, initial-scale=1.0, viewport-fit=cover` (`2326–2327`).
- Vite plugin menyalin production template source ke `dist/i/<slug>/index.html` dan `dist/production/<slug>/index.html` ketika `writeBundle` (`apps/web/vite-plugin-invitation.ts:82–98`). `scripts/create-client-invitation.cjs` tidak menghasilkan custom lightbox yang ditemukan.

### 3. Root Cause Analysis: Terverifikasi vs Belum Terbukti
**Terverifikasi:** Local Playwright viewport simulation 390×844 membuka gallery enam foto. Portrait pertama intrinsik 854×1280 dirender ~359×538 dengan computed `object-fit:contain`; tombol close berada dalam viewport dan klik melepas `.active`, body overflow kembali ke `visible`. Tidak ada console error saat pemeriksaan itu. Simulasi ini bukan perangkat fisik Android/iOS dan bukan production.

**Belum terkonfirmasi:** penyebab laporan pengguna. Kandidat yang perlu diuji pada browser/perangkat gagal: deployed HTML/CSS berbeda/stale, viewport browser dinamis dan safe-area/notch, overlay/stacking/hit target, CSS cascade aktual, event touch pada modal, atau perbedaan browser. Tombol close memang fixed `20px` tanpa inset safe-area; handler juga tidak menyimpan overflow sebelumnya. Keduanya kelemahan yang teramati, tetapi belum dibuktikan menyebabkan laporan. Jangan menyebut zoom selector `scale(1.08)` sebagai akar masalah preview; selector hanya thumbnail.

### 4. Rekomendasi Perbaikan
- Cocokkan markup dan build artifact yang benar-benar disajikan untuk `/i/anggi-ivan`, lalu periksa computed geometry, `elementFromPoint` pada X, visibility, z-index, pointer-events, event/touch target, dan scroll sebelum/sesudah close pada viewport/touch emulation.
- Bila reproduksi mengonfirmasi masalah ukuran: batasi image pada lebar **dan** tinggi viewport, pertahankan `object-fit:contain`, gunakan unit dinamis `dvh` dengan fallback `vh`, `min-width/min-height:0`, gutters dan safe-area insets; scoped hanya ke `.standalone-lightbox-*`.
- Bila close tidak terjangkau: posisikan X dalam safe-area, target sentuh besar, z-index/hit testing yang jelas. Bila touch handler mengganggu: abaikan swipe yang dimulai dari X/nav, gunakan event handling stabil, dan pastikan backdrop close hanya pada target backdrop.
- Simpan nilai body overflow inline sebelumnya saat open dan pulihkan persis saat close; pastikan beberapa sesi open/close tidak mengakumulasi listener. Jangan menambah library atau lightbox duplikat.
- Hanya ubah CSS/JS template `anggi-ivan` setelah penyebab direproduksi; update salinan dist lewat build pipeline, bukan edit manual. Jangan ubah generator kecuali ditemukan sebagai sumber output custom modal.

### 5. File/Selector yang Berpotensi Diubah (setelah persetujuan implementasi)
- `apps/web/public/production/anggi-ivan/index.html`: `.standalone-lightbox-modal`, `.standalone-lightbox-content`, `.standalone-lightbox-img`, `.standalone-lightbox-close`, `.standalone-lightbox-prev/.next` sekitar `578–676`; fungsi `setupGalleryLightbox`, `closeModal`, event click/backdrop/keydown/touch sekitar `7184–7248`.
- Build output `apps/web/dist/i/anggi-ivan/index.html` dan `apps/web/dist/production/anggi-ivan/index.html` dihasilkan oleh build Vite (`vite-plugin-invitation.ts:82–98`); jangan ubah langsung.
- `PLAN.md`: catatan hasil implementasi/tes setelah terverifikasi. Tidak ada rencana perubahan API, database, upload, atau template `raden-motion`.

### 6. Langkah Implementasi Berurutan
1. Reproduce pada production bila bisa dan local; simpan info browser/OS, portrait/landscape, response status, console, screenshot/DOM saat open.
2. Bandingkan source dan build artifact, pastikan hanya satu modal aktif; ukur image intrinsic/rendered size, viewport, modal, X hit target, computed styles dan `elementFromPoint`.
3. Tes tap X, backdrop, swipe, Escape, repeated open-close, body overflow dan scroll position.
4. Terapkan perubahan paling kecil hanya pada sebab yang teramati; pertahankan markup gallery/upload, visual thumbnail, transition, dan desktop.
5. Tambahkan satu runnable assertion/check untuk close/image constraints bila memungkinkan; build web dan verifikasi source/dist parity.
6. Dokumentasikan bukti dan hasil uji aktual; deployment memerlukan persetujuan terpisah.

### 7. Responsive Strategy
- Validasi 320×667, 375×812, 390×844, 430×932; tablet 768×1024 dan 1024×768; desktop 1280×800. Uji portrait dan landscape.
- Batasi preview pada viewport efektif dengan safe-area gutters, rasio asli (`contain`), tidak lebih besar dari lebar/tinggi tersedia; cegah horizontal overflow. Pastikan controls tidak tertutup browser chrome/notch.
- Jangan mengklaim perangkat fisik sudah diuji berdasarkan Playwright viewport simulation.

### 8. Lightbox Interaction
- Satu modal reusable, update current index saat foto lain dipilih.
- X accessible dan mudah disentuh; backdrop close hanya ketika backdrop sendiri menerima tap; Escape menutup; prev/next dan swipe tetap bekerja.
- Swipe tidak dijalankan bila gesture dimulai pada X/nav/control. Close membersihkan state dan memulihkan overflow sebelumnya/scroll; repeated open-close tidak memasang handler berulang.

### 9. Testing Checklist
- [ ] Portrait, landscape, dan resolusi besar tampil utuh tanpa crop/zoom; ukur rendered vs intrinsic aspect ratio.
- [ ] X terlihat dan dapat disentuh di viewport sempit, landscape, dan safe-area/notch.
- [ ] Close via X, backdrop, Escape (bila keyboard tersedia); masing-masing jalur teruji.
- [ ] Swipe prev/next berjalan; tap kontrol tidak memicu swipe/backdrop secara tidak sengaja.
- [ ] Buka-tutup berulang; scroll/overflow pulih, tidak ada listener/error Console baru.
- [ ] Tidak ada overflow horizontal, broken asset requests, atau regression desktop.
- [ ] Foto yang dikelola admin tetap tampil dan terbuka; template/klien lain tidak berubah.
- [ ] Catat jenis test: Playwright/emulasi saja atau juga perangkat fisik Android Chrome/iOS Safari.

### 10. Risiko & Mitigasi
| Risiko | Mitigasi |
|---|---|
| Root cause belum terbukti pada perangkat pengguna | Reproduce dan ukur dahulu; label hipotesis dengan jelas. |
| CSS global mengubah gambar lain | Scope semua rule ke `.standalone-lightbox-*`/`data-id="b6f6ff8"`. |
| Perubahan touch merusak swipe/backdrop | Uji gesture/control/backdrop terpisah, jangan menangani gesture dari tombol. |
| Build artifact stale atau berbeda | Build dari source-of-truth, bandingkan output; jangan edit dist manual. |
| Klaim kompatibilitas perangkat berlebihan | Laporkan simulasi dan tes fisik secara terpisah. |

### Implementation & Verification Status (2026-10-15)

- Setelah user menyetujui implementasi lightbox, hanya `apps/web/public/production/anggi-ivan/index.html` diubah. Ukuran preview dibatasi terhadap `100dvh`/`100vh` dan viewport width, dengan `object-fit:contain`, safe-area padding, serta aturan landscape. X dan nav diperbesar dan diposisikan memakai safe-area inset.
- Interaksi close menyimpan/memulihkan nilai inline `body.style.overflow`; tombol close/nav mencegah default/propagation. Swipe handler mengabaikan gesture yang dimulai dari tombol kontrol. Modal diberi `role="dialog"`, `aria-modal`, dan label; fokus dipindah ke X saat open dan dikembalikan setelah close.
- `npm run build --workspace=@you-are-invited/web` berhasil. Kedua HTML hasil build `apps/web/dist/i/anggi-ivan/index.html` dan `apps/web/dist/production/anggi-ivan/index.html` memuat perubahan (diperiksa melalui marker safe-area, 100dvh, dan scroll/focus handling).
- `git diff --check` tidak menemukan whitespace error (hanya warning normal CRLF/LF).
- Belum berhasil melakukan post-fix browser automation karena tool browser sementara tidak tersedia. Belum diverifikasi visual setelah perubahan, belum dilakukan tes perangkat fisik Android/iOS, dan tidak ada deployment production.
- Akar penyebab report pengguna masih belum dibuktikan pada perangkat asal. Perbaikan menangani batas viewport/safe area dan lifecycle interaksi yang teridentifikasi dari source; status perlu dianggap lokal/siap diuji, bukan production-verified.

### Langkah verifikasi lanjutan
1. Jalankan `/i/anggi-ivan` setelah frontend restart/reload; uji 320×667, 375×812, 390×844, 430×932, tablet, desktop, dan landscape memakai browser automation.
2. Uji foto portrait/landscape resolusi besar, X, backdrop, Escape, prev/next, swipe yang dimulai dari kontrol, open/close berulang, pemulihan focus/scroll, Console, serta Network.
3. Uji fisik Android Chrome dan iOS Safari bila tersedia; laporkan terpisah dari simulasi viewport.
4. Minta persetujuan deploy secara terpisah sebelum merilis build; verifikasi markup live dan smoke test setelah deployment.

Tidak mengubah template master `raden-motion`, upload/data gallery, API, ukuran nama mempelai, maupun klien lain.
---

## 12. Mobile Gallery Lightbox — Responsive Image & Close Button Fix

### Problem Summary
Pada perangkat mobile, pengguna melaporkan foto gallery `anggi-ivan` tampak terlalu besar/terpotong dan preview tidak dapat ditutup. Target: foto portrait maupun landscape utuh sesuai viewport; X mudah disentuh, backdrop/Escape tetap berfungsi, dan scroll pulih setelah tutup. Ini **rencana diagnosis/perbaikan**, bukan klaim bug sudah teratasi.

### Current Implementation — fakta kode
- Gallery `data-id="b6f6ff8"` dan `.elementor-gallery__container` memakai foto `payload.gallery`; `apps/web/public/production/anggi-ivan/index.html:7250–7284` membangun item dari API. Grid thumbnail memakai CSS client-only pada baris `518–575`. Foto hasil upload tetap menggunakan URL `/api/assets/:id`.
- Lightbox aktif merupakan implementasi custom `setupGalleryLightbox(items)` pada baris `7184–7248`, bukan penggantian yang perlu ditambah. Ia membuat satu `#standalone-lightbox`, `#lg-main-img`, tombol `#lg-close-btn`, previous/next, caption/counter; anchor gallery memanggil `openGalleryLightbox` pada baris `7257–7267`. Template memuat CSS Elementor/lightbox lama, tetapi pada sesi browser lokal tidak ditemukan modal `.elementor-lightbox` atau `.lg-outer` yang aktif.
- `.standalone-lightbox-img` sudah memiliki `max-width:100%`, `max-height:80vh`, `object-fit:contain`, dan animasi `scale(0.95)` ke `scale(1)` (`index.html:602–613`). `scale(1.08)` pada baris `560–562` hanya mengenai gambar **thumbnail**, bukan preview.
- Tombol X memakai `position:absolute; top:20px; right:20px; width/height:40px`, tanpa safe-area inset (`index.html:614–630`). Close memasang `onclick` dan backdrop click pada `7222–7225`, Escape pada `7227–7232`, swipe pada `7234–7240`. Open mengunci `document.body.style.overflow='hidden'`, sedangkan close mengosongkannya (`7217–7220`, `7242–7246`) alih-alih memulihkan nilai inline sebelumnya. Welcome modal template juga mengatur body overflow (`5744`). Ada rule template-wide `img { pointer-events:none !important }` (`2169–2172`); dampaknya terhadap touch modal belum dibuktikan.
- `apps/web/vite-plugin-invitation.ts:82–98` menyalin source client HTML ke `dist/i/...` dan `dist/production/...` ketika build. `scripts/create-client-invitation.cjs` tidak berisi kode custom lightbox tersebut; jangan mengedit generator tanpa bukti ia sumber perubahan yang perlu dipertahankan.

### Root Cause Analysis — terverifikasi vs hipotesis
- **Terverifikasi pada simulasi browser lokal 390×844:** Enam foto gallery terpasang. Foto portrait pertama berukuran intrinsik 854×1280 dan ter-render sekitar 359×538 dengan computed `object-fit:contain`; X berada dalam viewport dan klik menutup modal, body overflow kembali `visible`. Tidak terlihat error Console saat pemeriksaan itu. Ini **bukan** tes perangkat fisik atau bukti production bekerja sama.
- **Belum terverifikasi:** penyebab zoom/crop dan kegagalan close pada ponsel pengguna. Kemungkinan meliputi versi HTML/CSS production yang berbeda, viewport dinamis dan safe area/notch, computed style perangkat, event touch/click, atau modal lain yang tampil. Tidak ada screenshot/DOM/console perangkat pengguna yang membuktikan salah satu hipotesis. Jangan menganggap `object-fit:cover` berlaku pada preview tanpa computed style perangkat.
- **Kelemahan kode teridentifikasi, dampak belum terukur di perangkat bermasalah:** X 40px tanpa safe-area, `80vh` pada mobile dengan dynamic browser chrome, body overflow reset ke string kosong, serta `ontouchend` pada seluruh modal yang berpotensi menavigasi ketika gesture mengenai tombol. Tidak otomatis berarti itulah penyebab kejadian yang dilaporkan.

### Proposed Solution dan Implementation Steps — setelah persetujuan terpisah
1. Bandingkan HTML yang benar-benar disajikan pada `/i/anggi-ivan` (production dan lokal) dengan source; verifikasi hanya `#standalone-lightbox` aktif, tidak ada ID/modal duplikat. Periksa Console/Network, computed image/modal/button geometry, `elementFromPoint` pada posisi X, scroll lock, dan target event touch/click.
2. Reproduksi dengan foto portrait, landscape, dan resolusi besar di emulasi touch/viewport kecil; bila perlu minta screenshot, model perangkat/browser dan hasil inspeksi non-rahasia dari pengguna. Bedakan hasil emulasi dari uji perangkat Android/iOS asli.
3. Perbaiki **hanya penyebab yang terbukti** pada `apps/web/public/production/anggi-ivan/index.html`: scoped `.standalone-lightbox-*` untuk batas lebar/tinggi dua sumbu (`width/height:auto`, `max-width` viewport dikurangi gutter, `max-height` dengan `vh` fallback + `dvh`/safe-area bila diperlukan, `object-fit:contain`), dan perbesar/geser target X ke safe area jika tertutup. Jangan mengubah CSS global, thumbnail, animasi lain, atau template master.
4. Bila close/gesture terbukti bermasalah, pertahankan satu modal/handler: tombol X semantik, backdrop hanya saat target backdrop, Escape, swipe yang mengabaikan tombol kontrol, dan simpan/pulihkan nilai `body.style.overflow` sebelumnya. Pastikan buka/tutup berulang tidak menumpuk listener atau mengunci scroll.
5. Tambahkan satu pemeriksaan runnable ringan untuk struktur/handler dan verifikasi visual browser. Build web melalui pipeline agar salinan dist mengikuti source; jangan edit dist secara manual. Dokumentasikan hasil aktual sebelum deployment terpisah.

### Affected Files
- **Utama (bila root cause terverifikasi):** `apps/web/public/production/anggi-ivan/index.html` — CSS lightbox `578–676`, JS `7184–7248`.
- **Output build, bukan source kedua:** `apps/web/dist/i/anggi-ivan/index.html` dan `apps/web/dist/production/anggi-ivan/index.html` diperbarui oleh build Vite (`vite-plugin-invitation.ts:82–98`).
- **Pemeriksaan regresi kecil:** script/test minimal hanya jika logika non-trivial berubah. `PLAN.md` mencatat temuan dan hasil. Tidak ada rencana mengubah DB/API, upload gallery, musik, atau template klien lain.

### Responsive Strategy & Lightbox Interaction
- Ukur rendered image dibanding viewport **lebar dan tinggi** serta gambar intrinsik; jaga rasio aspek dengan `contain`. Sediakan ruang caption/kontrol dan safe-area perangkat ber-notch, terutama orientasi landscape. Pastikan tidak ada horizontal overflow.
- Kontrol X tetap terlihat/dapat ditekan (target sentuh setidaknya sekitar 44px bila ruang cukup); backdrop dan Escape menutup sesuai konteks. Jangan biarkan gesture swipe pada tombol memicu navigasi. Kembalikan scroll halaman ke kondisi semula; jangan menambah lightbox/library kedua.

### Testing Checklist
- [ ] Buka foto portrait, landscape, resolusi besar pada 320–375px, 390–430px, tablet 768–1024px, desktop 1280px+, termasuk orientasi landscape; gambar terlihat utuh dan tidak overflow horizontal/vertikal.
- [ ] Ketuk X, backdrop; Escape pada perangkat berkibor; swipe prev/next; uji target sentuh dekat safe area/notch.
- [ ] Buka/tutup berkali-kali; nilai overflow dan posisi scroll pulih, listener tidak berlipat, kontrol tetap responsif.
- [ ] Periksa Console dan Network: tidak ada error JS/request foto gagal; foto hasil upload dashboard tetap bisa dibuka.
- [ ] Bandingkan gallery desktop dan template klien lain; pastikan thumbnail, transisi, dan template master tidak berubah.
- [ ] Pisahkan laporan emulasi viewport/touch dari uji fisik Android Chrome/iOS Safari; jangan mengklaim uji perangkat nyata jika tidak dijalankan.

### Risks & Mitigation
- **Perbaikan CSS berdasarkan asumsi:** ukur computed style pada halaman gagal sebelum perubahan; scoped selector saja.
- **Stale deployment:** cocokkan markup/version yang disajikan dengan source/build, lalu verifikasi kembali pascadeploy jika diotorisasi.
- **Scroll/gesture regression:** simpan overflow awal; cek close, backdrop, Escape, swipe dan pembukaan berulang.
- **Efek ke klien lain:** jangan ubah master `raden-motion`, API, atau styling global.

**Status:** hanya investigasi read-only dan pembaruan `PLAN.md`; belum ada perubahan HTML/CSS/JS aplikasi, data, atau deployment untuk bug mobile ini. Tunggu persetujuan eksplisit sebelum implementasi.

---

## Client Revision — anggi-ivan: Wedding Hashtag, Akad Nikah Typography & Love Story Section

### 1. Current Project Analysis

**Verified:**
- Client template source is `apps/web/public/production/anggi-ivan/index.html`. Vite generates `apps/web/dist/i/anggi-ivan/index.html` and `apps/web/dist/production/anggi-ivan/index.html` via `apps/web/vite-plugin-invitation.ts:82–98`; do not edit build output directly.
- The source already contains an Elementor section labelled “Cerita Cinta” (`data-id="633fe11"`, approximately lines 3799–4144). Its toggle has three static entries and Lorem ipsum descriptions; JS hydrates `payload.story` around lines 7450–7467 and hides the old section if payload story is empty around 7617–7620.
- Existing SQLite `story_items` is invitation-scoped with required title/date/description and sort order (`apps/api/src/db/schema.ts:107–116`, `apps/api/src/db/client.ts:220–227`). The public route returns it ordered (`apps/api/src/routes/invitations.ts:43–48`) and the current HTML hydrates it into the legacy toggle. It has no photo field, and no story CRUD UI/API was found in the admin editor.
- `invitation_template_fields` already stores arbitrary text values per invitation. The public route exposes it as a key/value object; admin GET returns the field rows, and the existing invitation PATCH currently handles only specific fields. This gives a viable no-schema-change path: add a validated `love_story_items` JSON value to the existing invitation-scoped template fields, with explicit handling in existing public/admin routes. The editor does not already manage generic fields.
- Existing asset upload uses an invitation-scoped path: admin `uploadAssetFile` (`apps/web/src/routes/admin/editor.tsx:132–157`) calls `POST /api/admin/invitations/:id/assets` (`apps/api/src/routes/admin/invitations.ts`); gallery controls show the reusable UI pattern (`editor.tsx:425–465`). Assets are served at `/api/assets/:id`. Validate every selected photo asset belongs to the same invitation and has kind `image`.
- The user requests a visual exception for `anggi-ivan`; implementation remains pending plan approval. Keep unrelated template visuals, shared styles and other invitation pages unchanged.
- Add a separate “Kisah Cinta” section and remove the legacy “Cerita Cinta” placeholder subtree and its hydration from this client only, so static Lorem ipsum/date examples are absent from production markup. Use editable admin defaults “Awal Bertemu”, “Acara Lamaran” and “Acara Pernikahan”; leave descriptions blank until supplied. Render a titled card only when it has a valid photo or a non-empty description; omit cards with neither and hide the wrapper when none qualify.

### 2. Wedding Hashtag Removal

- Complete top-level section: `apps/web/public/production/anggi-ivan/index.html:4500–4712`, `data-id="70f3774"`; it contains a heading, image gallery, explanatory copy, WeddingPress copy-text widget and a closing image. Its Elementor styling includes a 90vh presentation, so remove the complete section subtree, not only its inner widgets.
- Section-specific hydration is around lines 7476–7485; conditional hide logic is around 7647–7650. Remove these `anggi-ivan`-only references with the section so no query targets deleted markup. Preserve the shared clipboard engine, invitation `hashtag` field/API, and admin field for other clients.
- Check neighboring sections' margins/min-heights after removal. Do not replace subtree removal with hiding inner widgets, which can leave reserved spacing. No other template or global hashtag feature changes.

### 3. Akad Nikah Time Typography — analysis only, do not edit

- **File:** HTML `apps/web/public/production/anggi-ivan/index.html`; source CSS asset `apps/web/public/template-assets/webinvite.id/wp-content/litespeed/css/c589d9794a40e358f1240a9ca156fe73.css` (the HTML links it at lines 796–800).
- **HTML line:** 3175–3188; widget `data-id="2d00970"`, currently “Pukul : 09:00 WIB - Selesai”; JS hydrates it from `events[0]` at line 7418. Resepsi time uses a different widget, `data-id="cf9695f"`.
- **CSS line:** `apps/web/public/template-assets/webinvite.id/wp-content/litespeed/css/c589d9794a40e358f1240a9ca156fe73.css:295`; selector `.elementor-62777 .elementor-element.elementor-element-2d00970 .elementor-heading-title`.
- **Desktop current:** 16px. **Mobile current:** 14px under `@media(max-width:767px)` in same minified stylesheet.
- **Suggested only:** desktop 18px; mobile 16px. No CSS edits in this task.
- The client-only `#raden-mobile-fixes` block is in the template HTML at lines 25–714, before the linked minified stylesheet (around line 799). If adding an override there, use a client-scoped selector with `!important` so the later shared rule does not win. Check the longest expected time label at 320px and 360px widths.

Example for client to apply later (not committed by this task):
```css
@media (min-width: 768px) {
  [data-id="2d00970"] .elementor-heading-title { font-size: 18px !important; }
}
@media (max-width: 767px) {
  [data-id="2d00970"] .elementor-heading-title { font-size: 16px !important; }
}
```

### 4. Akad Nikah Location Typography — analysis only, do not edit

- **File:** `apps/web/public/production/anggi-ivan/index.html`.
- **HTML line:** 3216–3229; widget `data-id="49ab019"`, paragraph `<p>` contains `Gedung Gelanggang Remaja, Desa Rejo, Kec. Wates, Kabupaten Kediri`. Hydration occurs at line 7419 from event venue name/address.
- **CSS line:** minified stylesheet line 295; `.elementor-62777 .elementor-element.elementor-element-49ab019` sets 15px on desktop. A later `@media(max-width:767px)` rule in the same file sets 12px and line-height 1.4. The inline `#raden-mobile-fixes` block has no matching Akad address override. Do not edit the shared stylesheet.
- This is the address description, not the map marker or “Lihat Lokasi” button (`data-id="2f59679"`). Resepsi uses a different paragraph/widget (`data-id="79f5f1d"`); do not target it.
- **Suggested only:** desktop 16px; mobile 14px. No font edits in this task.

Example for client to apply later (not committed by this task):
```css
@media (min-width: 768px) {
  [data-id="49ab019"] p { font-size: 16px !important; }
}
@media (max-width: 767px) {
  [data-id="49ab019"] p { font-size: 14px !important; }
}
```

### 5. Love Story Section Design

- Place the new section at the former `data-id="633fe11"` position, before the following section. Remove the legacy markup/hydration from `anggi-ivan` only; leave the shared `story` field/route available for other pages.
- Use a heading and three ordered, vertically stacked story cards. Each card contains its editable title, optional image, and optional description. Render an image only for a validated asset URL; set alt text, lazy loading, natural dimensions, bounded size, and `object-fit:contain`. Do not generate fallback/dummy story copy.
- Render a titled card only when it has a valid photo or non-empty description; render whichever of photo/description exists. Hide the entire section when no card qualifies. This keeps title-only defaults private while allowing partial real content.
- Scope new CSS and JS to a unique `anggi-ivan` section identifier. Match existing palette, typography, and ornaments; constrain content width, provide responsive gutters, preserve portrait/landscape proportions, keep the stack vertical on mobile, and wrap long descriptions. Reuse an existing animation only if dynamic elements safely participate; otherwise omit animation rather than add a dependency. Use DOM APIs and `textContent`, not HTML interpolation, for admin text.

### 6. Admin Dashboard Integration

- Existing editor has six tabs and reusable image upload, but no story controls. Add “Kisah Cinta” controls only when invitation slug is `anggi-ivan`, so other invitations do not gain this client-specific UI. Initialize three ordered editable titles; leave descriptions and image IDs empty.
- Reuse `uploadAssetFile(file, 'image')` with per-story upload/replace/remove controls, title and description inputs, and explicit reorder controls. Persist invitation-scoped state and refresh public preview only after a successful response; show upload/save errors without discarding the previously saved image association.
- Store media references as asset IDs, not user-entered URLs. The API must verify each referenced asset belongs to the current invitation and has kind `image`; client-provided IDs are not authorization.

### 7. Database & API Impact

- No new table or migration is currently justified. Reuse `invitation_template_fields` with one `love_story_items` JSON value scoped to `invitation_id`; leave `story_items` unchanged because it powers the legacy timeline and has incompatible required date/no-photo fields.
- Extend the existing admin invitation GET/PATCH flow (`apps/api/src/routes/admin/invitations.ts`) to parse, validate, and persist the field. Validate JSON shape, text lengths, order, invitation ownership, and image-kind/asset ownership. Keep writes failure-safe so a failed update retains saved content/photo references. No new endpoint is needed unless implementation later shows the existing PATCH cannot support the operation cleanly; report that before widening scope.
- Extend the public invitation payload (`apps/api/src/routes/invitations.ts`) with typed `loveStory` items mapped to `/api/assets/:id`; omit invalid, cross-invitation, or non-image photo references. Exclude the raw `love_story_items` JSON from the public generic `templateFields` record after parsing. Preserve the existing `story` contract.
- Add a shared `LoveStoryItem` type in `packages/shared-types/src/invitation.ts`. Since `invitation_template_fields` is generic string storage, application-level JSON validation is required; under this plan, `schema.ts` and `client.ts` need no change.

### 8. Affected Files

- `apps/web/public/production/anggi-ivan/index.html` — remove full hashtag and legacy dummy story subtrees plus their client-only hydration; add responsive Love Story markup/styles/hydration.
- `apps/web/src/routes/admin/editor.tsx` — slug-scoped editor, default titles, blank descriptions, upload/replace/remove, reorder, persistence and feedback.
- `apps/api/src/routes/admin/invitations.ts` — validate/persist `love_story_items` via existing invitation GET/PATCH and validate selected image ownership/kind.
- `apps/api/src/routes/invitations.ts` and `packages/shared-types/src/invitation.ts` — additive public payload and `LoveStoryItem` type.
- Focused API regression tests for persistence, invitation isolation, asset validation, malformed/empty data and ordering; add a markup/render assertion if repository conventions support one.
- `PLAN.md` — this plan until separately approved. Vite build output under `apps/web/dist/...` is generated from source, never edited manually.
- No expected change to `apps/api/src/db/schema.ts`, `apps/api/src/db/client.ts`, migrations, `apps/api/src/index.ts`, shared template CSS, template master, or other client pages under the current approach. Never edit typography in either template source or shared CSS.

### 9. Implementation Steps

1. Re-check current diffs and preserve unrelated local edits (including existing `anggi-ivan` lightbox changes); do not edit build output.
2. Add typed parsing/validation for the `love_story_items` invitation template field through existing admin GET/PATCH and public GET. Confirm no schema change or migration is needed.
3. Add API regression tests for invitation isolation, ordered persistence, malformed JSON, same-invitation image-only assets, failed-update preservation, and no-content behavior.
4. Add slug-scoped admin controls with three editable default titles, blank descriptions, per-item image upload/replace/remove, reorder, save/reload, and preview refresh on success.
5. In `anggi-ivan` source only, remove the complete `70f3774` section plus hashtag-specific hydration/conditional logic; retain generic clipboard behavior and shared hashtag data/API.
6. Hide legacy `633fe11` timeline only for this client; add the separate vertical Love Story section and safe conditional rendering after checking its position against adjacent sections.
7. Verify time/location selectors and current CSS values; make no typography edits. After approval, run focused tests/build and responsive visual checks. No migration or deployment.

### 10. Responsive & Interaction Testing

- API tests: valid/invalid payload parsing, order persistence, invitation isolation, cross-invitation and non-image asset rejection, empty/malformed content omission, and failed update retaining saved image/data.
- Admin: `anggi-ivan` can upload/replace/remove photos, edit titles/descriptions, reorder, save and reload; preview reflects saved state. Other invitation slugs do not show the client-specific editor; existing authentication remains enforced.
- Public: no hashtag text/image/copy action or 90vh gap; legacy Lorem ipsum absent; story headings/order correct; missing image never becomes a broken `<img>`; empty description has no dummy text; no empty card/section; long text wraps.
- Browser viewport check at 320×667, 375×812, 390×844, 430×932, 768×1024, 1024×768, 1280×800; portrait and landscape images remain proportional; no horizontal overflow or overlap. Check Console and Network.
- Regression: gallery/lightbox, background music, RSVP, maps/navigation work; no other invitation/template changes. Check diff confirms Akad font styles unchanged. Label emulation separately from physical Android Chrome/iOS Safari.
- Build output source parity only after approval; no deploy or live DB migration without separate authorization.

### 11. Risks & Mitigation

| Risk | Mitigation |
|---|---|
| Template fidelity rule | Treat the requested revision as a narrowly scoped `anggi-ivan` exception only after plan approval; leave the master, shared assets, typography and all other clients unchanged. |
| Legacy dummy story text | Remove legacy placeholder markup only on anggi-ivan; only real photo or approved description makes a new card public. |
| Empty section/90vh whitespace | Remove full hashtag section; conditionally omit empty story cards and wrapper, verify section geometry in browser. |
| Cross-invitation image/data leakage | Scope JSON storage by invitation ID; validate every asset belongs to that invitation and is an image before save and public rendering. |
| Failed photo replacement | Persist new association before removing/replacing old; retain old valid photo on request failure. |
| Shared minified CSS changes other clients | Do not edit shared CSS; client may later apply scoped override in HTML style block. |
| Mobile overflow/visual regression | Scoped CSS, bounded image/content width, natural aspect ratio, viewport matrix and gallery regressions. |
| Existing unrelated local changes | Review current diff and append without overwriting existing PLAN/template edits. |

### Implementation & Verification Status (2026-10-19)

- Removed the complete Wedding Hashtag section, its section-specific hydration/hide logic, and the legacy Lorem ipsum “Cerita Cinta” subtree/hydration from the `anggi-ivan` source. Shared hashtag fields and clipboard code remain intact.
- Added the vertical Love Story section with scoped typography/colors, responsive bounded images, `object-fit:contain`, text-only hydration, and conditional card/section rendering.
- Added invitation-scoped `love_story_items` persistence in existing `invitation_template_fields`; no schema/table migration or endpoint was added. Admin GET/PATCH and public GET now validate/transform the value and validate image asset invitation ownership/kind.
- Added the “Kisah Cinta” admin tab for `anggi-ivan` only, with three editable default titles, blank descriptions, photo upload/replace/remove, ordering controls, save/reload, and preview refresh after successful save.
- Akad time/location font CSS and HTML were not changed. No deployment or production database operation was performed.
- Verification: root `npm.cmd run build` passed; focused Love Story API tests passed (3/3). Browser/device visual checks have not been run; use the viewport checklist below before deployment.

**Status:** implementation is local and ready for visual review. Production deployment remains a separate action.

**Font reference values (for client):** Akad time 16px desktop / 14px mobile; Akad address 15px desktop / 12px mobile. Proposed recommendations: time 18px / 16px; address 16px / 14px. See sections 3–4; typography remains untouched.

## Bug Investigation — Love Story Section Not Rendering (anggi-ivan)

### 1. Problem Summary

The local invitation URL `http://localhost:5173/i/anggi-ivan?to=Nuno+Rifa` serves the current client production template, but its public API response contains `loveStory: []`. The page therefore hides the section by design. The available evidence confirms the immediate failure is before DOM rendering: the currently served backend/database has no persisted `love_story_items` record for this invitation.

### 2. End-to-End Data Flow

`Admin editor state` → `PATCH /api/admin/invitations/:invitationId` → `invitation_template_fields` row keyed `love_story_items` and scoped to invitation ID → `GET /api/invitations/:slug` parses and validates the row, resolves same-invitation image assets, and returns `loveStory[]` → static template fetches that public endpoint by slug → `renderLoveStory(payload.loveStory)` builds cards and reveals the section only when at least one card is eligible.

### 3. Layer-by-Layer Findings

| Layer | Status | Evidence and limit |
|---|---|---|
| Dashboard load/save | Partly verified | `apps/web/src/routes/admin/editor.tsx`: `load()` GETs `/api/admin/invitations/${invitationId}`; `save()` PATCHes the same invitation ID with `loveStory` only for slug `anggi-ivan`. A successful HTTP response sets “Perubahan tersimpan.” and upload explicitly instructs the admin to click Save. Three image upload records are present for this invitation, confirming the upload API succeeded. A read-only GET to the live local admin route returned 401 because this investigation has no admin session cookie; browser Network history and authenticated admin readback are therefore unavailable. We cannot prove whether the user's prior global Save click received 2xx or whether visible descriptions survived a reload. |
| Invitation identity | Verified | Local public API resolves slug `anggi-ivan` to invitation ID `inv-anggi-ivan`; these are different identifiers with the expected slug-to-ID mapping. Admin PATCH is keyed by invitation ID, while the public GET is keyed by slug. |
| Database persistence | Verified for the current local database | Read-only query of `storage/db/app.sqlite` found invitation `{id: inv-anggi-ivan, slug: anggi-ivan}` and **zero** `invitation_template_fields` rows with `field_key='love_story_items'` for that ID. Three uploaded image assets are present in `invitation_assets`, all `kind='image'` and owned by `inv-anggi-ivan`; however, no story JSON links them to titles/descriptions/order. No record contents were changed. The generic template-fields table has `id`, `invitation_id`, `field_key`, and `field_value`; no Love Story-specific active/published/visible column exists. The current implementation needs no migration because this table already exists. |
| Public API | Verified | `GET http://localhost:5173/api/invitations/anggi-ivan` returned HTTP 200 and `loveStory: []`. The handler reads only the invitation's `love_story_items` field, parses it, and maps image assets only if they are `kind='image'` and owned by the same invitation. With no stored field, it returns an empty array. The raw JSON field is intentionally excluded from generic `templateFields`. |
| Template markup and rendering | Verified statically and over HTTP | The requested URL returned HTTP 200 with the `anggi-ivan` production HTML (409,479 characters). It contains `#anggi-ivan-love-story`, `renderLoveStory(payload.loveStory)`, and no old Wedding Hashtag section marker. The root starts with inline `display:none`; the renderer removes that inline hiding only after it appends at least one eligible card. An empty array deliberately leaves the section hidden. This is not evidence of a CSS-only defect. |
| Vite route/API integration | Verified | `apps/web/vite-plugin-invitation.ts` prioritizes `public/production/anggi-ivan/index.html` for `/i/anggi-ivan` and serves it directly, without iframe or `postMessage`. `apps/web/vite.config.ts` proxies `/api` to `http://localhost:3000`; the template itself fetches `/api/invitations/anggi-ivan`. No service-worker handoff is used in this route. The response contained the new root and render call, so stale template HTML is not the cause in this local run. |
| Browser runtime | Not verified | No authenticated browser session or browser automation was available in this investigation. No claim is made about browser console output, image network loads, or visual viewport behavior. The empty API response already explains the current hide branch. |

### 4. Root Cause Based on Available Evidence

**Confirmed immediate root cause:** the database currently serving the local public endpoint has no persisted `love_story_items` field for `inv-anggi-ivan`; consequently the public API returns an empty array and the template's conditional renderer keeps the section hidden. Image upload itself succeeded: three invitation-scoped image asset records exist, but the story configuration that associates those assets with titles, descriptions, and order does not.

**Underlying reason the admin write is absent is not yet confirmed.** Source code inspection shows the intended PATCH payload and server persistence path are present. The uploaded assets are persisted, while story titles/descriptions/order are kept in editor state until the global Save request. Since the authenticated admin GET and the user's actual Save request/response history could not be inspected, evidence does not distinguish between the Save action not completing and the dashboard writing to a different API/database than the local Vite proxy serves. If a PATCH to this same API returned 2xx, the route implementation writes the field before responding; the current database state conflicts with that outcome and must be reconciled before changing rendering code.

Further static checks narrow the failure: the upload route commits an `invitation_assets` row and returns HTTP 201, while `handleLoveStoryPhoto()` only puts its returned asset ID into React state. The separate global `save()` sends title, description, photo ID, and order to PATCH. That PATCH validates the three items and their image ownership before writing `love_story_items`, then responds with `success: true` after the write. The normal startup seeder does not remove template fields for an existing `anggi-ivan` invitation. The three uploaded assets satisfy the invitation ID, image kind, and MIME checks, so cross-invitation photo filtering does not explain the current empty response. A hidden validation failure or missing Save request still requires the authenticated Network response to distinguish.

### 5. Files and Functions to Inspect or Change After Approval

- `apps/web/src/routes/admin/editor.tsx` — `load()`, `save()`, `handleLoveStoryPhoto()`: compare authenticated GET readback and actual PATCH request/response; if a request fails, show the backend error and preserve unsaved form state. If a request succeeds, read the saved values back before claiming persistence. Only change the persistence behavior once the observed failure is known.
- `apps/api/src/routes/admin/invitations.ts` — GET `/:id` and PATCH `/:id`: confirm runtime route is the source of the local admin response and its storage database.
- `apps/api/src/routes/invitations.ts` — GET `/:slug`: current public mapping is behaving consistently with the absent database row; change only if authenticated admin readback reveals a mapping/filter mismatch.
- `apps/web/vite.config.ts` and `apps/web/vite-plugin-invitation.ts` — current local proxy/template selection is verified; change only if server process configuration shows a different target at runtime.
- `apps/web/public/production/anggi-ivan/index.html` — root and render call are present; no template change is currently justified by evidence.

No application source changes are proposed until the authenticated admin readback or request log identifies why the database row was not written to the backend serving this page.

### 6. Minimal Safe Resolution Plan

1. With the same admin session/environment used to edit the invitation, read back `GET /api/admin/invitations/inv-anggi-ivan` and compare it with public `GET /api/invitations/anggi-ivan`.
2. Inspect the browser Network entry for the Save `PATCH`: confirm request URL uses ID `inv-anggi-ivan`, the body contains all three ordered story items and uploaded asset IDs, and the status is 2xx. Verify the subsequent admin GET still returns those values.
3. Confirm the dashboard and `/i/anggi-ivan` both use the local API target at port 3000 and the same SQLite database path. Do not copy, recreate, or reset data during this check.
4. If admin GET has the data but public GET does not, fix the public mapping/asset validation using the concrete mismatched field or asset evidence. If admin GET is also empty, fix the Save flow or align the dashboard's API/database target based on the observed request; do not weaken public conditional rendering.
5. After the approved minimal fix, verify read-after-write from the admin API, public API output, and rendered DOM. No new table, endpoint, or migration is currently indicated.

### 7. Verification Plan

- Save the three stories from the admin and verify the PATCH response, then reload the dashboard and verify values are read back from the backend.
- Read-only SQL check that `love_story_items` is attached to `inv-anggi-ivan` and contains valid titles, descriptions, photo asset IDs, and sort order; verify each referenced asset belongs to the same invitation and is an image.
- Confirm `GET /api/invitations/anggi-ivan` returns those three items in order with valid URLs, and does not expose the raw JSON field.
- Reload `/i/anggi-ivan`; verify the section, images, titles, and descriptions appear and reflect a subsequent admin edit.
- Verify all-empty data hides the section; title plus description renders without a photo; invalid/missing photo does not hide valid text; blank entries do not leave empty cards.
- Check browser console and Network; inspect desktop and mobile widths for layout/overflow. Recheck gallery, background music, RSVP, and a different invitation.
- Existing automated coverage: `apps/api/src/routes/admin/love-story.test.ts` checks defaults, public empty state, persistence/order, same-invitation image mapping, and rejects malformed/cross-invitation assets. Extend tests only if the confirmed defect lies outside those cases.

### 8. Regression Risks

- A mismatch between the admin and public API database can make a successful dashboard edit appear absent; log/compare target identity without exposing credentials.
- Avoid rendering empty defaults or placeholder descriptions on the public site.
- Preserve invitation scoping and same-invitation image checks; do not change unrelated clients or shared template assets.
- Preserve current hidden-on-empty behavior and ensure partial text/photo content remains valid.

### 9. Deployment and Migration

The observed URL is the local Vite development server. No deployment is required for the investigation, and none was performed. The current storage design uses the existing `invitation_template_fields` table; no database migration is required. If an eventual fix changes frontend/API source, restart the relevant local processes and rebuild/deploy only after a separate explicit request.

**Investigation status:** root cause is confirmed at the database-to-public-API boundary (the local DB record is absent). The underlying admin write/environment cause remains unverified pending an authenticated admin readback or Network trace. No application source code or database data was changed during this investigation.

### Approved Fix Implementation Status (2026-10-19)

The previous paragraph records the state at investigation time. The user then approved implementation, and the following local changes were made:

- **Persistence evidence:** An isolated API regression test submits the editor's complete invitation PATCH payload with all three Love Story items and image asset IDs, then reads the values back through admin GET and public GET. It passes. The existing API can persist this payload; the prior missing row cannot be attributed to a general backend PATCH failure. The exact earlier browser action or response remains unknown because its Network history and authenticated session are unavailable.
- **Dashboard fix:** `apps/web/src/routes/admin/editor.tsx` now marks Love Story edits and photo changes as unsaved, provides a dedicated **Simpan Kisah Cinta** action that PATCHes only `loveStory`, reports backend errors, and reads admin GET again before claiming success. The existing global Save also verifies Love Story readback for `anggi-ivan`. This guards against a success notice based only on React state or an HTTP response without durable content. The tab and payload remain scoped to `anggi-ivan`; other invitations retain their previous editor flow.
- **Local content recovery:** In the local `storage/db/app.sqlite`, `inv-anggi-ivan` had no `love_story_items` row, while three previously uploaded, invitation-owned JPEG assets existed. A guarded transaction inserted one `love_story_items` value in the existing `invitation_template_fields` table, associating those assets with the three requested default titles and order 0–2. Descriptions are empty because the original text was not persisted and the admin tab was closed/refreshed; no story text was fabricated. The actual matching of the three numbered upload filenames to the default story positions is based on their names, not recovered text metadata. The admin can edit and save these associations.
- **Current local public result:** `GET /api/invitations/anggi-ivan` now returns all three ordered stories with photo URLs. Each asset URL returns HTTP 200 and `image/jpeg`. Headless Chrome observed three rendered cards and titles, a visible section, no horizontal overflow at 390 × 844 or 1280 × 800, and no JavaScript exception events in that run. Its initial image measurement occurred before lazy images scrolled into view, so actual browser image decoding and visual appearance remain to be checked manually; successful image HTTP responses alone do not prove decoded display.
- **Checks completed:** Focused Love Story API suite: 4/4 passing, including the complete editor payload regression. Root web build passed. `git diff --check` passed. The live admin endpoint could not be queried without an authenticated cookie, so a real dashboard save/reload and photo replacement workflow remains a manual authenticated check.

**Remaining verification:** Sign in to the local admin editor for `inv-anggi-ivan`, confirm the three recovered photos and empty descriptions are loaded from the API, enter the client's actual descriptions, click **Simpan Kisah Cinta**, reload the dashboard, and verify the text persists. Reload `/i/anggi-ivan?to=Nuno+Rifa`, scroll to the section so its lazy images load, and check portrait/landscape display, the browser console, gallery, music, RSVP, and another invitation. No production data, migration, or deployment was changed or run.

