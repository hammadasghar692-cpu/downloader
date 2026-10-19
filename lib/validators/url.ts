import { z } from "zod";
export type Platform = "youtube" | "tiktok" | "instagram" | "facebook";
export const HOSTS: Record<Platform, string[]> = {
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"],
  tiktok: ["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"],
  instagram: ["instagram.com", "www.instagram.com"],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.watch"],
};
export const requestSchema = z.object({ url: z.string().trim().min(1, "Please paste a URL.").max(2048, "URL is too long.") });
export type Detection = { ok: true; platform: Platform; url: URL } | { ok: false; error: string };

/** Exact-hostname allowlist: rejects localhost, IPs, private ranges, credentials, odd ports and non-https. */
export function detectPlatform(raw: string): Detection {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return { ok: false, error: "Please check the URL and try again." }; }
  if (url.protocol !== "https:") return { ok: false, error: "Only https:// links are supported." };
  if (url.username || url.password) return { ok: false, error: "URLs with credentials are not allowed." };
  if (url.port) return { ok: false, error: "Custom ports are not allowed." };
  const host = url.hostname.toLowerCase();
  for (const p of Object.keys(HOSTS) as Platform[]) if (HOSTS[p].includes(host)) return { ok: true, platform: p, url };
  return { ok: false, error: "This platform is not supported. Supported: YouTube, TikTok, Instagram, Facebook." };
}
