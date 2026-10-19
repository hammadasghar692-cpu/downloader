// SSRF guard: protocol/port allowlist, literal-IP + DNS (DoH) checks, manual redirect validation.
export function isPrivateIp(ip: string): boolean {
  ip = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  if (ip.includes(":")) {
    const v4 = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4) return isPrivateIp(v4[1]);
    return ip === "::" || ip === "::1" || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith("ff");
  }
  return false;
}
const BAD_HOST = /(^localhost$|\.localhost$|\.local$|\.internal$|\.lan$)/;

async function doh(host: string, type: "A" | "AAAA"): Promise<string[]> {
  const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
    { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error("DNS lookup failed");
  const j: any = await r.json();
  return (j.Answer || []).filter((a: any) => a.type === (type === "A" ? 1 : 28)).map((a: any) => a.data);
}

export async function assertSafeUrl(raw: string): Promise<URL> {
  if (raw.length > 2048) throw new Error("URL too long");
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("Invalid URL"); }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http and https URLs are allowed");
  if (u.username || u.password) throw new Error("URLs with credentials are not allowed");
  if (u.port && !["80", "443"].includes(u.port)) throw new Error("Only ports 80 and 443 are allowed");
  const host = u.hostname.toLowerCase();
  if (BAD_HOST.test(host) || isPrivateIp(host)) throw new Error("This address is not allowed");
  if (!/^[\d.]+$/.test(host) && !host.includes(":")) {
    const ips = [...(await doh(host, "A")), ...(await doh(host, "AAAA").catch(() => []))];
    if (!ips.length) throw new Error("Host could not be resolved");
    if (ips.some(isPrivateIp)) throw new Error("This address is not allowed");
  }
  return u;
}

export interface Probe { finalUrl: string; type: string; size: number | null }
export async function probe(raw: string, maxBytes: number): Promise<Probe> {
  let url = (await assertSafeUrl(raw)).toString();
  for (let hop = 0; hop <= 3; hop++) {
    let r = await fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(8000) });
    if (r.status === 405 || (r.status >= 400 && r.status !== 404)) // some servers reject HEAD
      r = await fetch(url, { headers: { Range: "bytes=0-0" }, redirect: "manual", signal: AbortSignal.timeout(8000) });
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location"); if (!loc) throw new Error("Bad redirect");
      url = (await assertSafeUrl(new URL(loc, url).toString())).toString(); continue;
    }
    if (r.status >= 400) throw new Error(`Source server answered HTTP ${r.status}`);
    const type = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const range = r.headers.get("content-range")?.match(/\/(\d+)$/);
    const cl = r.headers.get("content-length");
    const len = range ? +range[1] : cl ? +cl : null;
    if (len !== null && len > maxBytes) throw new Error(`File is ${(len / 1048576).toFixed(1)} MB; your plan allows ${(maxBytes / 1048576) | 0} MB`);
    return { finalUrl: url, type, size: len };
  }
  throw new Error("Too many redirects");
}

export function isYoutube(u: URL): boolean {
  const h = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  return h === "youtube.com" || h === "youtu.be";
}
