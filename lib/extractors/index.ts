import type { Platform } from "@/lib/validators/url";
export type Status = "retrieved" | "partial" | "unavailable" | "platform_unavailable";
export interface Metadata {
  platform: Platform; sourceUrl: string; status: Status; message: string;
  title?: string; creator?: string; thumbnail?: string;
  description?: string; duration?: number; publishedAt?: string; hashtags?: string[];
  download: { supported: false; reason: string };
}
const NO_DL = { supported: false as const, reason: "Direct downloading is not supported for this media. Use the official viewing link." };
const OEMBED: Record<Platform, (u: string) => string | null> = {
  youtube: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  tiktok: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
  instagram: (u) => process.env.META_OEMBED_TOKEN ? `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(u)}&access_token=${process.env.META_OEMBED_TOKEN}` : null,
  facebook: (u) => process.env.META_OEMBED_TOKEN ? `https://graph.facebook.com/v19.0/oembed_video?url=${encodeURIComponent(u)}&access_token=${process.env.META_OEMBED_TOKEN}` : null,
};
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function normalize(platform: Platform, sourceUrl: string, d: Record<string, unknown>): Metadata {
  const thumb = str(d.thumbnail_url);
  const m: Metadata = { platform, sourceUrl, status: "partial", message: "Some information is unavailable for this platform.", download: NO_DL,
    title: str(d.title), creator: str(d.author_name), thumbnail: thumb?.startsWith("https://") ? thumb : undefined };
  if (!m.title && !m.creator && !m.thumbnail) { m.status = "unavailable"; m.message = "Metadata unavailable for this media."; }
  return m;
}
/** Uses only official oEmbed endpoints (fixed hosts, no redirects, 8s timeout). */
export async function getMetadata(platform: Platform, url: URL): Promise<Metadata> {
  const src = url.toString(), endpoint = OEMBED[platform](src);
  if (!endpoint) return { platform, sourceUrl: src, status: "unavailable", download: NO_DL,
    message: "Metadata for this platform requires a Meta oEmbed token that is not configured. Open the original link instead." };
  try {
    const r = await fetch(endpoint, { redirect: "error", signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
    if ([400, 401, 403, 404].includes(r.status))
      return { platform, sourceUrl: src, status: "unavailable", download: NO_DL, message: "This media is private, restricted, or not found." };
    if (!r.ok) throw new Error(String(r.status));
    return normalize(platform, src, (await r.json()) as Record<string, unknown>);
  } catch {
    return { platform, sourceUrl: src, status: "platform_unavailable", download: NO_DL, message: "The platform is temporarily unavailable. Please retry." };
  }
}
