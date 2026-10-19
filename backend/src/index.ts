import { assertSafeUrl, probe, isYoutube } from "./security";
import { hashPw, randHex, safeEq, signJwt, verifyJwt } from "./auth";

export interface Env { DB: D1Database; JWT_SECRET: string; ALLOWED_ORIGIN: string }
const now = () => Math.floor(Date.now() / 1000);
class HttpError extends Error { constructor(public status: number, m: string) { super(m); } }

// Auth uses Bearer tokens (not cookies), so cross-site CSRF does not apply; CORS is pinned to ALLOWED_ORIGIN.
const cors = (env: Env) => ({ "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN, "Access-Control-Allow-Headers": "Authorization,Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS", Vary: "Origin", "X-Content-Type-Options": "nosniff" });
const json = (env: Env, d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json", ...cors(env) } });

async function rateLimit(env: Env, key: string, limit: number, sec: number) {
  const win = Math.floor(now() / sec);
  await env.DB.prepare("INSERT INTO rate_limits(key,win,count) VALUES(?,?,1) ON CONFLICT(key,win) DO UPDATE SET count=count+1").bind(key, win).run();
  const r = await env.DB.prepare("SELECT count FROM rate_limits WHERE key=? AND win=?").bind(key, win).first<{ count: number }>();
  if ((r?.count ?? 0) > limit) throw new HttpError(429, "Too many requests. Please wait and try again.");
}
async function setting(env: Env, k: string) { return (await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(k).first<{ value: string }>())?.value ?? ""; }
async function body(req: Request): Promise<any> { try { return await req.json(); } catch { throw new HttpError(400, "Invalid JSON body"); } }
const emailOk = (e: any) => typeof e === "string" && e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

async function user(req: Request, env: Env) {
  const t = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  const p = t && await verifyJwt(t, env.JWT_SECRET);
  if (!p) throw new HttpError(401, "Please sign in");
  const u = await env.DB.prepare("SELECT id,email,role,plan,banned FROM users WHERE id=?").bind(p.sub).first<any>();
  if (!u || u.banned) throw new HttpError(403, "Account unavailable");
  return u;
}
const audit = (env: Env, actor: number, action: string, detail: string) =>
  env.DB.prepare("INSERT INTO audit_logs(actor,action,detail,created_at) VALUES(?,?,?,?)").bind(actor, action, detail.slice(0, 500), now()).run();

async function youtubeMeta(u: URL) {
  // Official public oEmbed endpoint: metadata only. No media is retrieved.
  const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u.toString())}`, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) return null;
  const j: any = await r.json();
  return { title: j.title, author: j.author_name, thumbnail: j.thumbnail_url };
}
const YT_MSG = "YouTube does not provide a public download endpoint, and this app does not bypass platform protections, so this video cannot be downloaded here. If you own the video, download the original from YouTube Studio (Content, then the ⋮ menu, then Download) or export it with Google Takeout, then use that file.";
const SAFE_ERR = /not allowed|Invalid|Only|too long|resolved|MB;|HTTP|redirect/;

async function analyze(req: Request, env: Env, u: any) {
  await rateLimit(env, `an:${u.id}`, 20, 60);
  const { url } = await body(req);
  if (typeof url !== "string") throw new HttpError(400, "URL is required");
  const plan = await env.DB.prepare("SELECT daily_limit,max_mb FROM plans WHERE name=?").bind(u.plan).first<any>() ?? { daily_limit: 5, max_mb: 100 };
  const used = await env.DB.prepare("SELECT COUNT(*) c FROM jobs WHERE user_id=? AND status IN('ready','downloaded') AND created_at>?").bind(u.id, now() - 86400).first<{ c: number }>();
  if ((used?.c ?? 0) >= plan.daily_limit) throw new HttpError(429, `Daily limit of ${plan.daily_limit} reached for the ${u.plan} plan.`);

  let status = "failed", message = "", meta: any = null, finalUrl: string | null = null, type: string | null = null, size: number | null = null, token: string | null = null, exp: number | null = null;
  try {
    const parsed = await assertSafeUrl(url);
    if (isYoutube(parsed)) { status = "unsupported"; message = YT_MSG; meta = await youtubeMeta(parsed).catch(() => null); }
    else {
      const p = await probe(url, plan.max_mb * 1048576);
      const allowed = (await setting(env, "allowed_types")).split(",");
      if (!allowed.includes(p.type)) { status = "unsupported"; message = `This link serves "${p.type || "unknown"}", not a supported direct media file. Supported: ${allowed.join(", ")}.`; }
      else { status = "ready"; finalUrl = p.finalUrl; type = p.type; size = p.size; token = randHex(16); exp = now() + 600; }
    }
  } catch (e: any) {
    message = e.name === "TimeoutError" ? "The source server timed out." : SAFE_ERR.test(e.message || "") ? e.message : "Could not reach the source.";
  }
  const r = await env.DB.prepare("INSERT INTO jobs(user_id,url,final_url,status,content_type,size,message,token,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .bind(u.id, url.slice(0, 2048), finalUrl, status, type, size, message, token, exp, now()).run();
  return { id: r.meta.last_row_id, status, message, meta, contentType: type, size, downloadPath: token ? `/api/d/${token}` : null, expiresAt: exp };
}

async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url), path = url.pathname, m = req.method;
  if (m === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
  const ip = req.headers.get("CF-Connecting-IP") || "?";

  if (path === "/api/config") return json(env, { maintenance: await setting(env, "maintenance") === "1", siteName: await setting(env, "site_name"), allowedTypes: (await setting(env, "allowed_types")).split(",") });

  if (path === "/api/auth/register" && m === "POST") {
    await rateLimit(env, `reg:${ip}`, 5, 3600);
    const { email, password } = await body(req);
    if (!emailOk(email) || typeof password !== "string" || password.length < 10 || password.length > 128) throw new HttpError(400, "Enter a valid email and a password of 10–128 characters.");
    const salt = randHex(16);
    try { await env.DB.prepare("INSERT INTO users(email,pass_hash,salt,created_at) VALUES(?,?,?,?)").bind(email.toLowerCase(), await hashPw(password, salt), salt, now()).run(); }
    catch { throw new HttpError(409, "That email is already registered."); }
    return json(env, { ok: true }, 201);
  }
  if (path === "/api/auth/login" && m === "POST") {
    await rateLimit(env, `login:${ip}`, 10, 900);
    const { email, password } = await body(req);
    const u = emailOk(email) && typeof password === "string" ? await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email.toLowerCase()).first<any>() : null;
    if (!u || u.banned || !safeEq(await hashPw(password, u.salt), u.pass_hash)) throw new HttpError(401, "Incorrect email or password.");
    return json(env, { token: await signJwt({ sub: u.id }, env.JWT_SECRET), user: { email: u.email, role: u.role, plan: u.plan } });
  }

  // Redirect-only download reference: the browser fetches from the origin; the Worker never proxies media bytes.
  const d = path.match(/^\/api\/d\/([a-f0-9]{32})$/);
  if (d && m === "GET") {
    await rateLimit(env, `dl:${ip}`, 30, 60);
    const j = await env.DB.prepare("SELECT id,final_url,expires_at FROM jobs WHERE token=?").bind(d[1]).first<any>();
    if (!j || j.expires_at < now()) throw new HttpError(410, "This download link expired. Analyze the URL again.");
    await assertSafeUrl(j.final_url); // re-validate DNS at redirect time
    await env.DB.prepare("UPDATE jobs SET status='downloaded',token=NULL WHERE id=?").bind(j.id).run(); // single use
    return new Response(null, { status: 302, headers: { Location: j.final_url, "Referrer-Policy": "no-referrer", ...cors(env) } });
  }

  const u = await user(req, env);
  if (await setting(env, "maintenance") === "1" && u.role !== "admin") throw new HttpError(503, "Under maintenance. Please try again soon.");

  if (path === "/api/me") return json(env, { ...u, plan: await env.DB.prepare("SELECT name,daily_limit,max_mb FROM plans WHERE name=?").bind(u.plan).first() });
  if (path === "/api/analyze" && m === "POST") return json(env, await analyze(req, env, u));
  if (path === "/api/jobs") return json(env, (await env.DB.prepare("SELECT id,url,status,content_type,size,message,created_at FROM jobs WHERE user_id=? ORDER BY id DESC LIMIT 50").bind(u.id).all()).results);
  if (path === "/api/report" && m === "POST") {
    await rateLimit(env, `rep:${u.id}`, 10, 3600);
    const { url: ru, reason } = await body(req);
    if (typeof ru !== "string" || typeof reason !== "string" || !reason.trim()) throw new HttpError(400, "URL and reason are required");
    await env.DB.prepare("INSERT INTO abuse_reports(user_id,url,reason,created_at) VALUES(?,?,?,?)").bind(u.id, ru.slice(0, 2048), reason.slice(0, 1000), now()).run();
    return json(env, { ok: true }, 201);
  }

  if (path.startsWith("/api/admin")) {
    if (u.role !== "admin") throw new HttpError(403, "Administrator access required");
    await rateLimit(env, `adm:${u.id}`, 120, 60);
    const q = (s: string, ...b: any[]) => env.DB.prepare(s).bind(...b);
    if (path === "/api/admin/stats") return json(env, await env.DB.prepare("SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM jobs) jobs,(SELECT COUNT(*) FROM jobs WHERE status IN('ready','downloaded')) successful,(SELECT COUNT(*) FROM jobs WHERE status='failed') failed,(SELECT COUNT(*) FROM jobs WHERE status='unsupported') unsupported").first());
    if (path === "/api/admin/users" && m === "GET") return json(env, (await q("SELECT id,email,role,plan,banned,created_at FROM users ORDER BY id DESC LIMIT 200").all()).results);
    const pu = path.match(/^\/api\/admin\/users\/(\d+)$/);
    if (pu && m === "PATCH") {
      const b = await body(req);
      if (b.plan !== undefined) { if (!await q("SELECT 1 FROM plans WHERE name=?", b.plan).first()) throw new HttpError(400, "Unknown plan"); await q("UPDATE users SET plan=? WHERE id=?", b.plan, +pu[1]).run(); }
      if (b.banned !== undefined) await q("UPDATE users SET banned=? WHERE id=? AND role!='admin'", b.banned ? 1 : 0, +pu[1]).run();
      await audit(env, u.id, "user.update", `${pu[1]} ${JSON.stringify(b)}`); return json(env, { ok: true });
    }
    if (path === "/api/admin/plans" && m === "GET") return json(env, (await q("SELECT * FROM plans").all()).results);
    const pp = path.match(/^\/api\/admin\/plans\/([a-z]+)$/);
    if (pp && m === "PUT") {
      const { daily_limit, max_mb } = await body(req);
      if (!Number.isInteger(daily_limit) || !Number.isInteger(max_mb) || daily_limit < 0 || max_mb < 1) throw new HttpError(400, "Invalid limits");
      await q("INSERT INTO plans VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET daily_limit=?,max_mb=?", pp[1], daily_limit, max_mb, daily_limit, max_mb).run();
      await audit(env, u.id, "plan.update", pp[1]); return json(env, { ok: true });
    }
    if (path === "/api/admin/settings" && m === "PUT") {
      const b = await body(req);
      for (const k of ["maintenance", "site_name", "allowed_types"]) if (typeof b[k] === "string") { const v = b[k].slice(0, 500); await q("INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=?", k, v, v).run(); }
      await audit(env, u.id, "settings.update", JSON.stringify(b)); return json(env, { ok: true });
    }
    if (path === "/api/admin/logs") return json(env, { errors: (await q("SELECT * FROM error_logs ORDER BY id DESC LIMIT 100").all()).results, audit: (await q("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100").all()).results });
    if (path === "/api/admin/reports") return json(env, (await q("SELECT * FROM abuse_reports ORDER BY id DESC LIMIT 100").all()).results);
  }
  throw new HttpError(404, "Not found");
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try { return await handle(req, env); }
    catch (e: any) {
      if (e instanceof HttpError) return json(env, { error: e.message }, e.status);
      await env.DB.prepare("INSERT INTO error_logs(message,created_at) VALUES(?,?)").bind(String(e?.message ?? e).slice(0, 500), now()).run().catch(() => {});
      return json(env, { error: "Internal error" }, 500); // never leak internals
    }
  },
};
