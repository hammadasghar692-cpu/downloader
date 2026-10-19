import { NextResponse } from "next/server";
import { requestSchema, detectPlatform } from "@/lib/validators/url";
import { getMetadata } from "@/lib/extractors";
import { rateLimit } from "@/lib/utils/rateLimit";
export const runtime = "nodejs";
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(ip)) return fail("Too many requests. Please wait a minute.", 429);
  if (Number(req.headers.get("content-length") ?? 0) > 4096) return fail("Request too large.", 413);
  let body: unknown;
  try { body = await req.json(); } catch { return fail("Invalid JSON body.", 400); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0].message, 400);
  const det = detectPlatform(parsed.data.url);
  if (!det.ok) return fail(det.error, 422);
  return NextResponse.json({ ok: true, data: await getMetadata(det.platform, det.url) });
}
