# VIP Media Downloader
React+Vite (Vercel) → Cloudflare Worker API → D1. Own code; no third-party downloader APIs.

## Structure
backend/src/{index,security,auth}.ts · backend/migrations/0001_init.sql · frontend/src/{App.jsx,api.js}

## How downloads work (and don't)
- The Worker validates the URL (http/https only, ports 80/443, no credentials, no private/loopback/metadata IPs, DNS checked via DoH, every redirect re-validated, max 3 hops, 8s timeouts), probes headers, enforces a content-type allowlist and the plan's size cap.
- It issues a single-use, 10-minute token. `/api/d/:token` re-validates and 302-redirects the browser to the origin. Media bytes never pass through the Worker. R2 is not implemented (optional future add-on).
- YouTube: recognised; title/author/thumbnail via YouTube's official oEmbed; no download offered. The UI explains the owner workflow (YouTube Studio → Content → ⋮ → Download, or Google Takeout).
- Known limit: Workers cannot pin the resolved IP, so DNS rebinding between our check and the browser's own fetch is possible; the final request is made by the user's browser, not our server.
- The progress bar shows analysis stages; transfer progress is shown by the browser's download manager.
- Not built: the plan editor UI (API exists: PUT /api/admin/plans/:name), abuse-report form in the UI (API exists: POST /api/report), profile page, R2.

## Local dev
    cd backend && npm i && cp .dev.vars.example .dev.vars
    npx wrangler d1 create vip-media        # paste database_id into wrangler.toml
    npx wrangler d1 migrations apply vip-media --local
    npm run dev                             # :8787
    cd ../frontend && npm i && cp .env.example .env && npm run dev   # :5173

Make an admin: register, then
`npx wrangler d1 execute vip-media --local --command "UPDATE users SET role='admin' WHERE email='you@x.com'"` (use `--remote` in production).

## Deploy
1. Backend: `wrangler secret put JWT_SECRET`; set `ALLOWED_ORIGIN` in wrangler.toml to your Vercel URL; `npx wrangler d1 migrations apply vip-media --remote`; `npm run deploy`.
2. Frontend: import `frontend/` into Vercel (Vite preset); set `VITE_API_URL` to the Worker URL.

## Tests
`cd backend && npm test` (SSRF unit tests). Manual checklist:
- valid MP4/MP3/WebM/image URL → Ready, download works once, fails after 10 min
- `http://127.0.0.1`, `http://169.254.169.254`, `ftp://`, `user:pw@` URLs → rejected
- host redirecting to a private IP → rejected; HTML page URL → "not a supported direct media file"
- file over plan cap → size message; slow host → timeout message; offline browser → network message
- YouTube URL → metadata + limitation message, no download button
- 11th login attempt in 15 min → 429; daily limit → 429; maintenance on → users 503, admin still works
- non-admin calling `/api/admin/*` → 403

## Free-tier limits (verify current numbers on the vendors' pricing pages)
Workers free: ~100k requests/day, ~10 ms CPU per request (PBKDF2 login may exceed this; error 1102 means use Workers Paid). D1 free: 5 GB storage, ~5M row reads/day, ~100k writes/day. Vercel Hobby is for non-commercial use.

## Troubleshooting
CORS error → `ALLOWED_ORIGIN` must equal the exact frontend origin. 401 loops → JWT_SECRET not set. "Cannot reach the server" → wrong `VITE_API_URL`. Login 500 → check CPU limit above. D1 errors → migrations not applied to that environment.
