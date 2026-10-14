# Investigation Plan: Production Music Upload Returns 413

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
| Database migration | Not required | Existing invitation_assets schema |

**Manual production evidence needed if 413 remains after deploy:** failing response headers/body, active web container `nginx -T` output for the upload location (redact secrets), Nginx error-log lines at request time, API logs at the same timestamp, and whether Cloudflare/proxy is enabled. Never share cookies or secret values.
