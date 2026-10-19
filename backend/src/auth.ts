const enc = new TextEncoder();
const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
export const randHex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, "0")).join("");

export async function hashPw(pw: string, salt: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 100000 }, k, 256); // 100k = Workers max
  return b64u(bits);
}
export function safeEq(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const key = (s: string) => crypto.subtle.importKey("raw", enc.encode(s), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
export async function signJwt(p: object, secret: string, ttl = 86400) {
  const body = b64u(enc.encode(JSON.stringify({ ...p, exp: Math.floor(Date.now() / 1000) + ttl })));
  const head = b64u(enc.encode('{"alg":"HS256","typ":"JWT"}'));
  return `${head}.${body}.${b64u(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(`${head}.${body}`)))}`;
}
export async function verifyJwt(t: string, secret: string): Promise<any | null> {
  try {
    const [h, b, s] = t.split("."); if (!h || !b || !s) return null;
    if (!await crypto.subtle.verify("HMAC", await key(secret), unb64u(s), enc.encode(`${h}.${b}`))) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64u(b)));
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}
