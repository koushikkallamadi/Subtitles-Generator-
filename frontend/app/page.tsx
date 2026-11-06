"use client";

import { useRouter } from "next/navigation";
import { ArrowUpFromLine, CheckCircle2, Languages, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import TopBar from "../components/TopBar";
import { Button, DottedLines, Highlight } from "../components/brand/BrandUI";
import { BRAND } from "../lib/brand";
import { useAuth } from "../components/AuthProvider";
import { backendUrl, fetchProjects, uploadProject } from "../lib/projects";
import { useVideoStore } from "../store/videoStore";

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hasProjects, setHasProjects] = useState(false);
  const { requireLogin, loading: authLoading, user } = useAuth();

  useEffect(() => {
    let active = true;
    if (!user) { setHasProjects(false); return () => { active = false; }; }
    void fetchProjects().then((projects) => { if (active) setHasProjects(projects.length > 0); }).catch(() => { if (active) setHasProjects(false); });
    return () => { active = false; };
  }, [user]);

  const acceptFile = async (file: File) => {
    if (file.size > 500 * 1024 * 1024 || (!file.type.startsWith("video/") && !file.type.startsWith("audio/"))) {
      setUploadError(file.size > 500 * 1024 * 1024 ? "File size exceeds 500 MB limit." : "Unsupported file type.");
      return;
    }
    setUploadError("");
    setUploading(true);
    try {
      const { language, style } = useVideoStore.getState();
      const project = await uploadProject(file, language, style);
      const store = useVideoStore.getState();
      store.setVideoData(`${backendUrl}/media/${project.id}`, project.title, project.size, project.duration);
      store.setProjectId(project.id);
      store.setLanguage(project.language);
      store.setStyle(project.style);
      router.push(`/editor?project=${encodeURIComponent(project.id)}`);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void requireLogin(() => { void acceptFile(file); }, "/");
  };

  return (
    <div
      className="marketing-theme min-h-screen overflow-hidden"
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
      onDrop={handleDrop}
    >
      <TopBar theme="marketing" showHistory={hasProjects} />
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void requireLogin(() => { void acceptFile(file); }, "/"); event.currentTarget.value = ""; }}
      />

      <main className="mx-auto flex min-h-[calc(100svh-64px)] w-full max-w-[1720px] flex-col justify-center px-5 py-3 sm:px-9 lg:px-0 lg:py-3">
        <section className="relative isolate flex w-full flex-1 items-center overflow-hidden bg-white">
          <DottedLines />
          <div aria-hidden="true" className="hero-orange-glow" />
          <div className="relative z-10 grid w-full items-center gap-4 py-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(390px,.88fr)] lg:pl-[9vw] lg:pr-0 xl:gap-6">
            <div className="max-w-[900px]">
              <p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-muted sm:mb-5 sm:text-sm">For reels · shorts · YouTube · podcasts</p>
              <h1 className="font-display text-[clamp(3.35rem,4.5vw,5rem)] leading-[.94] text-ink">
                <span className="block">Your words, your</span>
                <span className="block">language,</span>
                <span className="mt-1 block font-['SF_Pro_Display',-apple-system,BlinkMacSystemFont,sans-serif] text-[clamp(2.85rem,3.9vw,4.25rem)] font-bold italic tracking-[-0.02em]"><Highlight className="marker-subtitles bg-[#FF8A45] text-ink">your Subtitles.</Highlight></span>
              </h1>
              <p className="mt-5 max-w-[620px] text-base leading-7 text-muted sm:mt-6 sm:text-lg sm:leading-8">Turn Hindi, Telugu, and more into captions people love to read. Choose Hinglish, Tenglish, or native scripts. Edit every word, perfect the timing, and make each reel yours.</p>
              <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-7">
                <Button type="button" onClick={() => void requireLogin(() => fileInputRef.current?.click(), "/")} disabled={uploading || authLoading} className="min-h-12 px-7 text-sm disabled:cursor-wait disabled:opacity-60">
                  <ArrowUpFromLine size={18} />{uploading ? "Uploading video…" : "Start free"}
                </Button>
                <Button href="/upload" variant="secondary" className="min-h-12 px-7 text-sm"><Sparkles size={17} /> See them write</Button>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2.5 sm:mt-6 sm:gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E1DB] bg-white px-3 py-1.5 text-[11px] font-semibold text-muted shadow-[0_3px_10px_rgba(17,17,17,.06)] sm:px-3.5 sm:text-xs"><CheckCircle2 size={15} className="text-[#D65A26]" /> Hinglish</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E1DB] bg-white px-3 py-1.5 text-[11px] font-semibold text-muted shadow-[0_3px_10px_rgba(17,17,17,.06)] sm:px-3.5 sm:text-xs"><CheckCircle2 size={15} className="text-[#D65A26]" /> Tenglish</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E1DB] bg-white px-3 py-1.5 text-[11px] font-semibold text-muted shadow-[0_3px_10px_rgba(17,17,17,.06)] sm:px-3.5 sm:text-xs"><CheckCircle2 size={15} className="text-[#D65A26]" /> Native scripts</span>
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-muted sm:mt-5"><Languages size={14} /> MP4, MOV, audio · up to 500 MB</p>
              {uploadError && <p role="alert" className="mt-4 max-w-xl border-l-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800">{uploadError}</p>}
            </div>

            <div className="relative mx-auto flex w-full max-w-[620px] flex-col items-center px-5 py-7 sm:px-10 lg:-translate-x-8 lg:py-9 xl:-translate-x-12">
              <div aria-hidden="true" className="absolute inset-x-6 top-1/2 h-[68%] -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(17,17,17,.19),transparent_68%)] blur-xl" />
              <div className="relative z-10 mb-[-1px] w-full rotate-[-3deg] bg-[#111111] px-8 py-4 text-center text-xs font-bold uppercase tracking-[.16em] text-white shadow-[0_12px_28px_rgba(17,17,17,.16)] sm:w-[88%]">{BRAND.name} · word by word</div>
              <div className="relative z-10 grid aspect-[1.7/1] w-full place-items-center bg-[#111111] px-5 text-center text-[clamp(1.4rem,3vw,2.4rem)] font-bold leading-tight text-white shadow-[0_24px_48px_rgba(17,17,17,.18)] sm:w-[92%]">
                <span>Har word,<br /><span className="text-[#FF8A45]">aapki awaaz.</span></span>
                <span className="absolute right-[-12px] top-1/2 rotate-[4deg] bg-white px-3 py-2 text-xs font-semibold text-ink shadow-md sm:right-[-30px] sm:text-sm">हिंदी · Hinglish</span>
              </div>
              <div className="relative z-10 mt-[-1px] w-full rotate-[2deg] bg-[#111111] px-8 py-4 text-center text-xs font-bold tracking-wide text-white shadow-[0_14px_30px_rgba(17,17,17,.16)] sm:w-[88%]">Exports ready in seconds</div>
            </div>
          </div>
          {dragging && <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-white/95"><p className="font-display text-3xl text-[var(--accent-strong)]"><ArrowUpFromLine className="mr-3 inline" />Drop your video to get started</p></div>}
        </section>
        <footer className="flex flex-col items-center justify-between gap-2 px-2 py-3 text-[11px] text-muted sm:flex-row"><span>{BRAND.name} · {BRAND.tagline}</span><a href={`mailto:${BRAND.supportEmail}`} className="hover:text-[var(--accent-strong)]">{BRAND.supportEmail}</a></footer>
      </main>
    </div>
  );
}
