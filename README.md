# MediaX Downloader (core)
Next.js (App Router) + TypeScript + Tailwind v4 + Zod. Analyzes YouTube/TikTok/Instagram/Facebook links and shows available metadata.

## Run
`npm install && npm run dev` · tests: `npm test` · build: `npm run build`

## Env
See `.env.example`. `META_OEMBED_TOKEN` (optional) enables Instagram/Facebook metadata via Meta oEmbed.

## Honest limitations
- Metadata comes only from official oEmbed endpoints: title, creator, thumbnail. Description, duration, formats and hashtags are not exposed there, so they show "Not available for this media."
- Direct downloading is NOT implemented. Vercel serverless cannot host yt-dlp/FFmpeg workloads, and platform terms restrict it. The UI offers an official viewing link instead.
- Rate limiting is in-memory per instance; use Vercel KV/Upstash for global limits.
- Not yet verified: install, lint, build and tests have not been run.

## Deploy
Push to GitHub, import the repo in Vercel, set env vars, deploy.
