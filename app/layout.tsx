import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "MediaX Downloader", description: "Analyze supported media links and view available metadata." };
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body></html>);
}
