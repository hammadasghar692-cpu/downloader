import DownloaderForm from "@/components/DownloaderForm";
export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16 text-center">
      <p className="mb-3 font-semibold text-violet-300">MediaX Downloader</p>
      <h1 className="mb-4 text-4xl font-bold sm:text-5xl">Download Smarter. Manage Your Media.</h1>
      <p className="mx-auto mb-8 max-w-xl text-slate-400">Explore supported media links, retrieve available metadata, and access compatible download options through one simple interface.</p>
      <DownloaderForm />
      <section className="mx-auto mt-16 max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 text-left">
        <h2 className="mb-2 font-semibold">About the Developer</h2>
        <p className="text-sm font-medium">Hammad Asghar <span className="text-slate-400">· Developer and Creator of MediaX Downloader</span></p>
        <p className="mt-2 text-sm text-slate-300">Hammad Asghar is the developer and creator of MediaX Downloader, a project focused on making media-link processing and available video information easier to access through a simple, modern web experience.</p>
      </section>
      <p className="mt-10 text-xs text-slate-500">You are responsible for having permission to use any content you submit. Not affiliated with any platform.</p>
    </main>);
}
