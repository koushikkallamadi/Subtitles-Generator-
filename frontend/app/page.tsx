"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpFromLine, AudioLines, Captions, Languages, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import TopBar from "../components/TopBar";
import { useAuth } from "../components/AuthProvider";
import { backendUrl, fetchProjects, uploadProject } from "../lib/projects";
import { useVideoStore } from "../store/videoStore";

const languageOptions = [
  { name: "Hinglish", detail: "Roman Hindi", mark: "हि" },
  { name: "Marathi", detail: "मराठी", mark: "म" },
  { name: "Tamil", detail: "தமிழ்", mark: "த" },
  { name: "Telugu", detail: "తెలుగు", mark: "తె" },
  { name: "English", detail: "English", mark: "EN" },
];

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
      className="min-h-screen overflow-hidden bg-[#0c0d11] text-white"
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
      onDrop={handleDrop}
    >
      <TopBar projectName="Desi Subtitles" showHistory={hasProjects} />
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={(event) => { const file = event.target.files?.[0]; if (file) void requireLogin(() => { void acceptFile(file); }, "/"); event.currentTarget.value = ""; }}
      />

      <main className="mx-auto flex w-full max-w-[1440px] flex-col px-4 py-5 sm:px-7 lg:px-10 lg:py-8">
        <section className="relative isolate flex min-h-[min(780px,calc(100vh-120px))] items-center overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#111216] px-6 py-10 shadow-[0_40px_120px_rgba(0,0,0,.34)] sm:px-10 lg:px-14 xl:px-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_12%_18%,rgba(226,111,82,.17),transparent_36%),radial-gradient(ellipse_at_88%_65%,rgba(121,61,52,.13),transparent_42%)]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 -z-10 h-[440px] w-[440px] rounded-full border border-white/[0.035]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-12 -z-10 h-[310px] w-[310px] rounded-full border border-white/[0.035]" />

          <div className="grid w-full items-center gap-12 lg:grid-cols-[minmax(360px,.92fr)_minmax(440px,1.08fr)] xl:gap-20">
            <div className="relative mx-auto flex w-full max-w-[580px] items-center justify-center lg:justify-start">
              <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#df6f53]/[0.08] blur-3xl lg:left-[45%]" />
              <div className="relative flex items-center gap-3 sm:gap-5">
                <div className="relative h-[390px] w-[220px] overflow-hidden rounded-[32px] border border-white/15 bg-[#191a20] p-2 shadow-[0_28px_80px_rgba(0,0,0,.45)] sm:h-[470px] sm:w-[270px]">
                  <div className="relative flex h-full flex-col overflow-hidden rounded-[25px] bg-[radial-gradient(ellipse_at_50%_20%,#725346_0%,#302a2c_32%,#17181c_72%)] p-4">
                    <div aria-hidden="true" className="absolute -left-12 top-20 h-48 w-48 rounded-full bg-[#b9744e]/30 blur-2xl" />
                    <div aria-hidden="true" className="absolute -right-12 bottom-20 h-52 w-44 rounded-full bg-[#493b55]/60 blur-2xl" />
                    <div className="relative flex items-center justify-between text-[10px] text-white/80">
                      <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1.5">● &nbsp;Caption preview</span>
                      <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1.5">00:06</span>
                    </div>
                    <div className="relative my-auto flex h-24 items-center justify-center gap-1 opacity-60" aria-hidden="true">
                      {Array.from({ length: 23 }, (_, index) => <span key={index} className="w-1 rounded-full bg-gradient-to-t from-[#ef8d68] to-[#f5c078]" style={{ height: `${14 + ((index * 17) % 58)}px` }} />)}
                    </div>
                    <div className="relative rounded-2xl border border-white/10 bg-[#09090bcc] px-4 py-4 text-center text-[15px] font-bold leading-6 shadow-lg sm:text-lg">
                      Every word,
                      <br />
                      <span className="text-[#f1a16e]">right on time.</span>
                    </div>
                    <div className="relative mt-4 flex justify-center gap-1.5" aria-hidden="true">
                      {Array.from({ length: 9 }, (_, index) => <span key={index} className={`h-1.5 rounded-full ${index === 4 ? "w-5 bg-[#ef895f]" : "w-1.5 bg-white/35"}`} />)}
                    </div>
                  </div>
                </div>
                <div className="flex w-[118px] flex-col gap-2 sm:w-[150px]">
                  {languageOptions.map((language, index) => (
                    <div key={language.name} className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 transition sm:gap-3 sm:px-4 ${index === 0 ? "border-[#ef8a5e]/60 bg-[#dc713f] text-white shadow-[0_8px_25px_rgba(209,101,60,.22)]" : "border-white/10 bg-[#191a20]/90 text-gray-300"}`}>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-semibold ${index === 0 ? "bg-white/15" : "bg-white/[0.06] text-gray-400"}`}>{language.mark}</span>
                      <span className="min-w-0"><span className="block truncate text-xs font-semibold sm:text-sm">{language.name}</span><span className={`block truncate text-[10px] ${index === 0 ? "text-white/75" : "text-gray-500"}`}>{language.detail}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[670px] lg:mx-0">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e78561]/20 bg-[#e78561]/[0.08] px-3.5 py-2 text-xs font-medium text-[#f0a47f]">
                <AudioLines size={15} /> Made for the way India speaks
              </div>
              <h1 className="max-w-[700px] text-[clamp(2.65rem,5.1vw,5.1rem)] font-semibold leading-[1.02] tracking-[-0.055em]">
                Your reel,
                <br />
                <span className="bg-gradient-to-r from-[#f1a36f] via-[#eb795f] to-[#cf6c85] bg-clip-text text-transparent">heard in every</span>
                <br />
                language.
              </h1>
              <p className="mt-6 max-w-[540px] text-base leading-7 text-gray-400 sm:text-lg sm:leading-8">
                Turn speech into precise, editable captions in Roman and native Indian scripts. Tune every cue, then style it for the screen.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => void requireLogin(() => fileInputRef.current?.click(), "/")}
                  disabled={uploading || authLoading}
                  className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#e77b5d] to-[#e98b68] px-7 text-sm font-semibold text-[#211411] shadow-[0_12px_34px_rgba(221,110,77,.22)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(221,110,77,.32)] disabled:cursor-wait disabled:opacity-60"
                >
                  <ArrowUpFromLine size={18} className="transition group-hover:-translate-y-0.5" />
                  {uploading ? "Uploading video…" : "Add your video"}
                </button>
                <Link href="/upload" className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.035] px-7 text-sm font-semibold text-gray-100 transition hover:border-[#dc8067]/60 hover:bg-white/[0.07]">
                  <Sparkles size={17} className="text-[#e99879]" /> Try a sample
                </Link>
              </div>

              <p className="mt-4 flex items-center gap-2 text-xs text-gray-500"><Languages size={14} /> MP4, MOV, audio · up to 500 MB · or drop a file anywhere</p>
              {uploadError && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">{uploadError}</p>}

              <div className="mt-12 grid max-w-[570px] grid-cols-3 gap-3 border-t border-white/[0.08] pt-6">
                <div><p className="text-lg font-semibold text-white">Word-level</p><p className="mt-1 text-[11px] text-gray-500 sm:text-xs">timing you can edit</p></div>
                <div><p className="text-lg font-semibold text-white">5+ scripts</p><p className="mt-1 text-[11px] text-gray-500 sm:text-xs">built for Indian speech</p></div>
                <div><p className="flex items-center gap-1.5 text-lg font-semibold text-white"><Captions size={17} className="text-[#e99879]" /> Styled</p><p className="mt-1 text-[11px] text-gray-500 sm:text-xs">ready for every reel</p></div>
              </div>
            </div>
          </div>

          {dragging && <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-[24px] border-2 border-dashed border-[#ee9878] bg-[#100f11]/90 backdrop-blur-sm"><div className="text-center"><ArrowUpFromLine className="mx-auto mb-3 text-[#ee9878]" size={32} /><p className="text-lg font-semibold">Drop your video to get started</p></div></div>}
        </section>
        <footer className="flex flex-col items-center justify-between gap-2 px-2 py-5 text-[11px] text-gray-600 sm:flex-row"><span>CaptionKit · Subtitles that sound like you</span><span>Made for creators, wherever the words take you.</span></footer>
      </main>
    </div>
  );
}
