"use client";
import { useState } from "react";
import { Search, X, Copy, ExternalLink, RotateCw, Loader2 } from "lucide-react";
import type { Metadata } from "@/lib/extractors";
const NA = "Not available for this media.";
function Row({ l, v, onCopy }: { l: string; v?: string; onCopy: (l: string, v?: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2">
      <div><p className="text-xs text-slate-400">{l}</p><p className="text-sm">{v ?? NA}</p></div>
      {v && <button aria-label={`Copy ${l}`} onClick={() => onCopy(l, v)} className="rounded-lg p-2 hover:bg-white/10"><Copy size={16} /></button>}
    </div>);
}
export default function DownloaderForm() {
  const [url, setUrl] = useState(""); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(""); const [data, setData] = useState<Metadata | null>(null); const [toast, setToast] = useState("");
  const say = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2000); };
  async function analyze(e?: React.FormEvent) {
    e?.preventDefault(); setBusy(true); setErr(""); setData(null);
    try {
      const r = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const j = await r.json(); if (!j.ok) setErr(j.error); else setData(j.data);
    } catch { setErr("Network error. Please retry."); } finally { setBusy(false); }
  }
  const copy = async (label: string, v?: string) => { if (!v) return; await navigator.clipboard.writeText(v); say(`${label} copied`); };
  const all = data ? [`Platform: ${data.platform}`, `Title: ${data.title ?? NA}`, `Creator: ${data.creator ?? NA}`, `URL: ${data.sourceUrl}`].join("\n") : "";
  return (
    <div className="mx-auto w-full max-w-2xl">
      <form onSubmit={analyze} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="u" className="sr-only">Media URL</label>
          <input id="u" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a YouTube, TikTok, Instagram or Facebook link"
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 pr-10 text-sm" />
          {url && <button type="button" aria-label="Clear input" onClick={() => { setUrl(""); setData(null); setErr(""); }} className="absolute right-2 top-2.5 p-1"><X size={18} /></button>}
        </div>
        <button disabled={busy || !url.trim()} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold disabled:opacity-50">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />} Analyze Media
        </button>
      </form>
      <div aria-live="polite" className="mt-4">
        {busy && <div className="animate-pulse rounded-2xl bg-slate-900 p-6 text-sm text-slate-400">Analyzing your media link...</div>}
        {err && <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{err}
          <button onClick={() => analyze()} className="ml-3 inline-flex items-center gap-1 underline"><RotateCw size={12} /> Retry</button></div>}
        {data && (
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 text-left">
            {data.thumbnail && <img src={data.thumbnail} alt="" referrerPolicy="no-referrer" className="mb-4 max-h-56 w-full rounded-xl object-cover" />}
            <p className="mb-2 text-xs uppercase tracking-wide text-violet-300">{data.platform} · {data.status.replace("_", " ")}</p>
            <p className="mb-2 text-sm text-slate-300">{data.message}</p>
            <Row l="Title" v={data.title} onCopy={copy} /><Row l="Creator" v={data.creator} onCopy={copy} />
            <Row l="Description" v={data.description} onCopy={copy} />
            <Row l="Duration" v={data.duration ? `${data.duration}s` : undefined} onCopy={copy} />
            <Row l="Hashtags" v={data.hashtags?.join(" ")} onCopy={copy} />
            <p className="mt-3 text-sm text-slate-400">{data.download.reason}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => copy("All metadata", all)} className="rounded-lg bg-white/10 px-3 py-2 text-sm">Copy All Metadata</button>
              <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-sm"><ExternalLink size={14} /> Open Original Video</a>
            </div>
          </div>)}
      </div>
      {toast && <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-slate-800 px-4 py-2 text-sm shadow-lg">{toast}</div>}
    </div>);
}
