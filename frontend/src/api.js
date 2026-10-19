export const API_BASE = import.meta.env.VITE_API_URL;
export async function api(path, opts = {}) {
  const t = sessionStorage.getItem("vip_token");
  let r;
  try {
    r = await fetch(API_BASE + path, { ...opts, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: opts.body && JSON.stringify(opts.body) });
  } catch { throw new Error("Cannot reach the server. Check your connection and try again."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}
