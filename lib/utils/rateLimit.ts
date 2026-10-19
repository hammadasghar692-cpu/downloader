// In-memory limiter: per-instance only on serverless. Use Upstash/Vercel KV for global limits.
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max = 20, windowMs = 60_000, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return false; }
  recent.push(now); hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}
