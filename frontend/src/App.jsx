import { useEffect, useState } from "react";
import { api, API_BASE } from "./api";

const fmt = (b) => (b == null ? "unknown size" : b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : (b / 1024).toFixed(0) + " KB");
const Logo = () => <span className="font-display text-2xl text-gold tracking-wide">VIP <span className="text-ivory">Media</span></span>;

function Auth({ onAuth }) {
  const [mode, setMode] = useState("login"), [email, setEmail] = useState(""), [pw, setPw] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (mode === "register") await api("/api/auth/register", { method: "POST", body: { email, password: pw } });
      const r = await api("/api/auth/login", { method: "POST", body: { email, password: pw } });
      sessionStorage.setItem("vip_token", r.token); onAuth();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="card mx-auto mt-10 max-w-md space-y-3">
      <h2 className="font-display text-2xl">{mode === "login" ? "Sign in" : "Create your account"}</h2>
      <input className="inp" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="inp" type="password" placeholder="Password (10+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && <p role="alert" className="text-red-300 text-sm">{err}</p>}
      <button className="btn w-full" disabled={busy} onClick={submit}>{mode === "login" ? "Sign in" : "Create account"}</button>
      <button className="text-sm text-gold underline" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}</button>
    </div>
  );
}

function Downloader({ me, onDone }) {
  const [url, setUrl] = useState(""), [res, setRes] = useState(null), [err, setErr] = useState(""), [step, setStep] = useState(0);
  const analyze = async () => {
    setErr(""); setRes(null); setStep(1);
    try { setRes(await api("/api/analyze", { method: "POST", body: { url } })); setStep(2); onDone(); }
    catch (e) { setErr(e.message); setStep(0); }
  };
  const steps = ["Paste a link", "Checking the source", "Result"];
  return (
    <div className="mt-8 space-y-5">
      <h1 className="font-display text-4xl sm:text-5xl">Download media you are allowed to keep.</h1>
      <p className="text-ivory/70 max-w-xl">Direct MP4, WebM, MP3 and image links. Plan: <b>{me.plan?.name}</b> — {me.plan?.daily_limit} per day, up to {me.plan?.max_mb} MB.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input className="inp text-lg" placeholder="https://example.com/video.mp4" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && analyze()} />
        <button className="btn2" onClick={async () => setUrl(await navigator.clipboard.readText().catch(() => url))}>Paste</button>
        <button className="btn" disabled={!url || step === 1} onClick={analyze}>Analyze</button>
      </div>
      <ol className="flex gap-2" aria-label="progress">{steps.map((s, i) => <li key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-gold" : "bg-gold/20"}`} title={s} />)}</ol>
      {err && <p role="alert" className="card border-red-400/40 text-red-200">{err}</p>}
      {res && (
        <div className="card space-y-3">
          {res.meta?.thumbnail && <img src={res.meta.thumbnail} alt="" className="max-h-44 rounded-xl" />}
          {res.meta && <p className="font-semibold">{res.meta.title} <span className="text-ivory/60 font-normal">by {res.meta.author}</span></p>}
          {res.status === "ready" && <>
            {res.contentType?.startsWith("image/") && <img src={url} alt="Preview" className="max-h-64 rounded-xl" referrerPolicy="no-referrer" />}
            {res.contentType?.startsWith("video/") && <video src={url} controls preload="metadata" className="max-h-64 rounded-xl" referrerPolicy="no-referrer" />}
            {res.contentType?.startsWith("audio/") && <audio src={url} controls preload="none" />}
            <p>Format: <b>{res.contentType}</b> · {fmt(res.size)} · original file, no re-encoding</p>
            <a className="btn inline-block" href={API_BASE + res.downloadPath}>Download file</a>
            <p className="text-xs text-ivory/50">Link works once and expires in 10 minutes. Your browser downloads straight from the source.</p>
          </>}
          {res.status !== "ready" && <p className="text-amber-200">{res.message}</p>}
        </div>
      )}
    </div>
  );
}

function History({ tick }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { api("/api/jobs").then(setRows).catch(() => {}); }, [tick]);
  return (
    <div className="mt-10"><h2 className="font-display text-2xl mb-3">Your history</h2>
      {rows.length === 0 ? <p className="text-ivory/60">Nothing yet. Analyze a link above.</p> :
        <div className="space-y-2">{rows.map((r) => <div key={r.id} className="card !p-3 flex justify-between gap-3 text-sm"><span className="truncate">{r.url}</span><span className="shrink-0 text-gold">{r.status}</span></div>)}</div>}
    </div>
  );
}

function Admin() {
  const [s, setS] = useState(null), [users, setUsers] = useState([]), [logs, setLogs] = useState({ errors: [] }), [reports, setReports] = useState([]), [cfg, setCfg] = useState(null), [msg, setMsg] = useState("");
  const load = () => { api("/api/admin/stats").then(setS); api("/api/admin/users").then(setUsers); api("/api/admin/logs").then(setLogs); api("/api/admin/reports").then(setReports); api("/api/config").then(setCfg); };
  useEffect(load, []);
  const patch = async (id, body) => { await api(`/api/admin/users/${id}`, { method: "PATCH", body }); load(); };
  const save = async (b) => { await api("/api/admin/settings", { method: "PUT", body: b }); setMsg("Saved"); load(); };
  if (!s) return <p className="mt-8">Loading…</p>;
  return (
    <div className="mt-8 space-y-6">
      <h1 className="font-display text-3xl">Admin</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{Object.entries(s).map(([k, v]) => <div key={k} className="card !p-3"><div className="text-2xl text-gold">{v}</div><div className="text-xs">{k}</div></div>)}</div>
      {cfg && <div className="card space-y-2"><h2 className="font-semibold">Settings</h2>
        <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.maintenance} onChange={(e) => save({ maintenance: e.target.checked ? "1" : "0" })} /> Maintenance mode</label>
        <label className="block text-sm">Allowed content types (comma separated)<input className="inp mt-1" defaultValue={cfg.allowedTypes.join(",")} onBlur={(e) => save({ allowed_types: e.target.value })} /></label>{msg && <p className="text-xs text-gold">{msg}</p>}</div>}
      <div className="card overflow-x-auto"><h2 className="font-semibold mb-2">Users</h2>
        <table className="w-full text-sm"><tbody>{users.map((u) => <tr key={u.id} className="border-t border-gold/10"><td className="py-1">{u.email}</td><td>{u.role}</td>
          <td><select className="inp !py-1" value={u.plan} onChange={(e) => patch(u.id, { plan: e.target.value })}><option>free</option><option>vip</option></select></td>
          <td><button className="btn2" onClick={() => patch(u.id, { banned: !u.banned })}>{u.banned ? "Unban" : "Ban"}</button></td></tr>)}</tbody></table></div>
      <div className="card"><h2 className="font-semibold mb-2">Abuse reports ({reports.length})</h2>{reports.map((r) => <p key={r.id} className="text-sm truncate">{r.url} — {r.reason}</p>)}</div>
      <div className="card"><h2 className="font-semibold mb-2">Error log</h2>{logs.errors.map((e) => <p key={e.id} className="text-xs">{new Date(e.created_at * 1000).toLocaleString()} {e.message}</p>)}</div>
    </div>
  );
}

const LEGAL = {
  privacy: ["Privacy Policy", "We store your email, a salted password hash, and a record of the URLs you analyze so we can show your history and enforce limits. We do not sell data. Replace this text with a reviewed policy before launch."],
  terms: ["Terms", "Use this service only for media you own or are authorized to download. Do not use it to bypass DRM, paywalls, or platform protections. Accounts that abuse the service may be banned. Replace with reviewed terms before launch."],
  contact: ["Contact", "Set your support address here (for example support@your-domain.com)."],
};

export default function App() {
  const [view, setView] = useState("home"), [me, setMe] = useState(null), [ready, setReady] = useState(false), [tick, setTick] = useState(0), [maint, setMaint] = useState(false), [open, setOpen] = useState(false);
  const refresh = () => api("/api/me").then(setMe).catch(() => setMe(null)).finally(() => setReady(true));
  useEffect(() => { api("/api/config").then((c) => setMaint(c.maintenance)).catch(() => {}); refresh(); }, []);
  const logout = () => { sessionStorage.removeItem("vip_token"); setMe(null); setView("home"); };
  const nav = (v) => { setView(v); setOpen(false); };
  return (
    <div className="min-h-screen flex flex-col">
      <header className="relative border-b border-gold/15"><div className="mx-auto flex max-w-4xl items-center justify-between p-4">
        <button onClick={() => nav("home")}><Logo /></button>
        <button className="sm:hidden btn2" onClick={() => setOpen(!open)} aria-expanded={open}>Menu</button>
        <nav className={`${open ? "flex" : "hidden"} absolute right-4 top-16 z-10 flex-col gap-2 rounded-xl bg-plum p-4 sm:static sm:flex sm:flex-row sm:bg-transparent sm:p-0`}>
          {me?.role === "admin" && <button className="btn2" onClick={() => nav("admin")}>Admin</button>}
          {me && <><span className="self-center text-sm text-ivory/60">{me.email}</span><button className="btn2" onClick={logout}>Sign out</button></>}
        </nav></div></header>
      <main className="mx-auto w-full max-w-4xl flex-1 p-4">
        {maint && <p className="card mb-4 text-amber-200">Maintenance mode is on. Downloads are paused.</p>}
        {LEGAL[view] ? <div className="card mt-8"><h1 className="font-display text-3xl mb-3">{LEGAL[view][0]}</h1><p>{LEGAL[view][1]}</p></div>
          : !ready ? null : !me ? <Auth onAuth={refresh} />
          : view === "admin" && me.role === "admin" ? <Admin />
          : <><Downloader me={me} onDone={() => setTick(tick + 1)} /><History tick={tick} /></>}
      </main>
      <footer className="border-t border-gold/15 p-4 text-center text-sm text-ivory/60 space-x-4">
        {["privacy", "terms", "contact"].map((k) => <button key={k} className="underline" onClick={() => nav(k)}>{LEGAL[k][0]}</button>)}
      </footer>
    </div>
  );
}
