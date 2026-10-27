"use client";

import { ChangeEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_CAPTION_STYLE, useVideoStore } from "../../store/videoStore";
import { validateCaptionStyle } from "../../lib/captionStyle";
import { detectCaptionPreset } from "../../lib/captionPresets";
import TopBar from "../../components/TopBar";
import GeneratePanel from "../../components/GeneratePanel";
import TransportBar from "../../components/TransportBar";
import Timeline from "../../components/Timeline";
import TranscriptTab from "../../components/TranscriptTab";
import CaptionOverlay from "../../components/style/CaptionOverlay";
import { backendUrl, fetchProject, fetchProjectCues, patchProject, saveProjectCues, uploadProject } from "../../lib/projects";
import { useAuth } from "../../components/AuthProvider";

export default function EditorPage() {
  return <Suspense fallback={<div className="grid h-screen place-items-center bg-[#0b0f1a] text-sm text-gray-300">Loading project…</div>}><EditorContent /></Suspense>;
}

function EditorContent() {
  const router = useRouter();
  const queryProjectId = useSearchParams().get("project");
  const { user, loading: authLoading, requireLogin, refreshUser } = useAuth();
  const store = useVideoStore();
  const { videoUrl, projectName, duration: storeDuration, cues, timingOffset } = store;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(storeDuration || 0);
  const [projectLoading, setProjectLoading] = useState(true);
  const [mediaMissing, setMediaMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reuploading, setReuploading] = useState(false);
  const saveRevision = useRef(0);

  useEffect(() => {
    const projectId = queryProjectId || useVideoStore.getState().projectId;
    if (authLoading) return;
    if (projectId && !user) {
      setProjectLoading(false);
      void requireLogin(undefined, `/editor?project=${encodeURIComponent(projectId)}`);
      return;
    }
    if (!projectId) {
      setProjectLoading(false);
      if (!useVideoStore.getState().videoUrl) router.push("/");
      return;
    }
    if (projectId !== useVideoStore.getState().projectId) setProjectLoading(true);
    let cancelled = false;
    void Promise.all([fetchProject(projectId), fetchProjectCues(projectId)]).then(([project, apiCues]) => {
      if (cancelled) return;
      const mappedCues = apiCues.map((cue) => ({ start: cue.start, end: cue.end, text: cue.text, linked: cue.linked ?? true, timing_quality: cue.timing_quality ?? "estimated", words: cue.words || cue.words_json || [], manuallyEdited: false }));
      const settings = project.settings_json || {};
      useVideoStore.setState({
        projectId: project.id, videoUrl: project.media_available ? `${backendUrl}/media/${project.id}` : null,
        projectName: project.title || project.file_name, fileSize: project.size, duration: project.duration,
        language: project.language, style: project.style, cues: mappedCues, originalCues: mappedCues.map((cue) => ({ ...cue, words: cue.words?.map((word) => ({ ...word })) })),
        captionStyle: validateCaptionStyle(settings.captionStyle || DEFAULT_CAPTION_STYLE),
        selectedCaptionPreset: detectCaptionPreset(validateCaptionStyle(settings.captionStyle || DEFAULT_CAPTION_STYLE)),
        timingOffset: Math.max(-1, Math.min(1, Number(settings.timingOffset ?? 0))), maxWordsPerLine: Number(settings.maxWordsPerLine ?? 4), maxLinesPerSubtitle: Number(settings.maxLinesPerSubtitle ?? 2), savingState: "saved",
      });
      setDuration(project.duration || 0);
      setMediaMissing(!project.media_available);
      setProjectLoading(false);
    }).catch((error) => {
      if (!cancelled) { setLoadError(error instanceof Error ? error.message : "Could not load project."); setProjectLoading(false); }
    });
    return () => { cancelled = true; };
  }, [router, queryProjectId, authLoading, user, requireLogin]);

  useEffect(() => {
    if (projectLoading || !store.projectId) return;
    const revision = ++saveRevision.current;
    if (store.savingState !== "unsaved") store.setSavingState("saving");
    const timer = window.setTimeout(() => {
      const latest = useVideoStore.getState();
      latest.setSavingState("saving");
      const settings_json = { timingOffset: latest.timingOffset, maxWordsPerLine: latest.maxWordsPerLine, maxLinesPerSubtitle: latest.maxLinesPerSubtitle, captionStyle: latest.captionStyle };
      void Promise.all([
        saveProjectCues(latest.projectId!, latest.cues.map((cue) => ({ start: cue.start, end: cue.end, text: cue.text, linked: cue.linked, timing_quality: cue.timing_quality, words: cue.words || [] }))),
        patchProject(latest.projectId!, { language: latest.language, style: latest.style, duration: latest.duration, settings_json }),
      ]).then(() => { if (saveRevision.current === revision) useVideoStore.getState().setSavingState("saved"); })
        .catch(() => { if (saveRevision.current === revision) useVideoStore.getState().setSavingState("error"); });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [projectLoading, mediaMissing, store.projectId, store.cues, store.timingOffset, store.maxWordsPerLine, store.maxLinesPerSubtitle, store.language, store.style, store.duration, store.captionStyle]);

  const activeCue = cues?.find(
    (c) => currentTime >= (c.start + timingOffset) && currentTime < (c.end + timingOffset)
  );

  useEffect(() => {
    if (!projectLoading && !videoUrl && !mediaMissing && !loadError) {
      router.push("/");
    }
  }, [videoUrl, mediaMissing, loadError, projectLoading, router]);

  useEffect(() => {
    if (storeDuration && !duration) {
      setDuration(storeDuration);
    }
  }, [storeDuration, duration]);
useEffect(() => {
  const video = videoRef.current;
  if (!video || !isPlaying) return;
  let frameId = 0;
  let animationId = 0;
  const onVideoFrame = (_now: number, metadata: VideoFrameCallbackMetadata) => {
    setCurrentTime(metadata.mediaTime);
    frameId = video.requestVideoFrameCallback(onVideoFrame);
  };
  const onAnimationFrame = () => {
    setCurrentTime(video.currentTime);
    animationId = requestAnimationFrame(onAnimationFrame);
  };
  if ('requestVideoFrameCallback' in video) frameId = video.requestVideoFrameCallback(onVideoFrame);
  else animationId = requestAnimationFrame(onAnimationFrame);
  return () => {
    if (frameId && 'cancelVideoFrameCallback' in video) video.cancelVideoFrameCallback(frameId);
    if (animationId) cancelAnimationFrame(animationId);
  };
}, [isPlaying]);
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
  };

  const handleRegenerate = async () => {
    const latest = useVideoStore.getState();
    if (!latest.videoUrl) throw new Error('No video loaded.');
    const formData = new FormData();
    if (latest.projectId) formData.append('project_id', latest.projectId);
    else {
      const media = await fetch(latest.videoUrl, { credentials: 'include' });
      if (!media.ok) throw new Error('Could not read the video for regeneration.');
      formData.append('file', await media.blob(), latest.projectName || 'video.mp4');
    }
    formData.append('language', latest.language);
    formData.append('style', latest.style);
    const submitted = await fetch(`${backendUrl}/api/transcribe`, { method: 'POST', credentials: 'include', body: formData });
    const submission = await submitted.json().catch(() => ({}));
    if (!submitted.ok) throw new Error(typeof submission.detail === 'string' ? submission.detail : `Could not start regeneration (${submitted.status}).`);
    await refreshUser();
    for (let attempt = 0; attempt < 90; attempt++) {
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      const response = await fetch(`${backendUrl}/api/jobs/${submission.job_id}`, { credentials: 'include' });
      if (!response.ok) continue;
      const job = await response.json();
      if (job.status === 'failed') throw new Error(job.error || 'Regeneration failed.');
      if (job.status !== 'completed') continue;
      if (!Array.isArray(job.cues) || !job.cues.length) throw new Error('No speech was detected. Existing captions were kept.');
      useVideoStore.getState().setCues(job.cues);
      await refreshUser();
      return;
    }
    throw new Error('Regeneration timed out.');
  };

  const recoverMissingMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setReuploading(true); setLoadError("");
    try {
      const project = await uploadProject(file, store.language, store.style);
      useVideoStore.setState({ projectId: project.id, videoUrl: `${backendUrl}/media/${project.id}`, projectName: project.title, fileSize: project.size, duration: project.duration, savingState: "saved" });
      await saveProjectCues(project.id, store.cues.map((cue) => ({ start: cue.start, end: cue.end, text: cue.text, linked: cue.linked, timing_quality: cue.timing_quality, words: cue.words || [] })));
      await patchProject(project.id, { settings_json: { timingOffset: store.timingOffset, maxWordsPerLine: store.maxWordsPerLine, maxLinesPerSubtitle: store.maxLinesPerSubtitle, captionStyle: store.captionStyle } });
      router.replace(`/editor?project=${encodeURIComponent(project.id)}`);
      setMediaMissing(false);
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Could not upload the replacement video."); }
    finally { setReuploading(false); }
  };

  if (projectLoading) return <div className="grid h-screen place-items-center bg-[#0b0f1a] text-sm text-gray-300">Loading project…</div>;
  if (mediaMissing) return <div className="flex h-screen flex-col bg-[#0b0f1a] text-white"><TopBar projectName={projectName} savingState={store.savingState} /><main className="m-auto w-full max-w-lg rounded-2xl border border-gray-800 bg-[#151a26] p-8 text-center"><h1 className="text-lg font-semibold">This video is no longer stored</h1><p className="mt-2 text-sm text-gray-400">Your project and subtitles are still available. Pick the video again to restore playback.</p><label className="mt-5 inline-flex cursor-pointer rounded-lg bg-[#d96b52] px-4 py-2 text-sm font-medium text-white">{reuploading ? "Uploading…" : "Pick your video again"}<input type="file" accept="video/*,audio/*" className="hidden" disabled={reuploading} onChange={(event) => void recoverMissingMedia(event)} /></label>{loadError && <p role="alert" className="mt-3 text-sm text-red-300">{loadError}</p>}</main></div>;
  if (loadError && !videoUrl) return <div className="grid h-screen place-items-center bg-[#0b0f1a] text-sm text-red-300">{loadError}</div>;
  if (!videoUrl) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0b0f1a] text-white">
      <TopBar projectName={projectName} savingState={store.savingState} />
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: Video preview, TransportBar, Timeline */}
        <main className="flex flex-1 flex-col h-full overflow-hidden">
          {/* Video preview (flex-1, min-h-0, shrinks) */}
          <div className="flex flex-1 min-h-0 items-center justify-center p-4 bg-black/40 overflow-hidden">
            <div className="relative flex h-full max-h-full w-full items-center justify-center rounded-2xl bg-black overflow-hidden shadow-2xl">
              <video
                ref={videoRef}
                crossOrigin="use-credentials"
                src={videoUrl}

                onLoadedMetadata={() => {
                  if (videoRef.current?.duration) {
                    setDuration(videoRef.current.duration);
                    useVideoStore.setState({ duration: videoRef.current.duration });
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                onSeeked={(event) => setCurrentTime(event.currentTarget.currentTime)}
                className="h-full w-full object-contain"
              />

              <CaptionOverlay cue={activeCue} currentTime={currentTime} videoRef={videoRef} />
            </div>
          </div>

          {/* TransportBar (play, time, scrubber) */}
          <div className="w-full px-4 pb-2">
            <TransportBar
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
            />
          </div>

          {/* TIMELINE PANEL (fixed height 220px) */}
          <Timeline
            currentTime={currentTime}
            duration={duration}
            fileName={projectName}
            onSeek={handleSeek}
          />
        </main>

        {/* Right sidebar */}
        {cues && cues.length > 0 ? (
          <div className="flex min-w-0 flex-col h-full w-[26rem] bg-[#1a1e2b] p-3">
            <TranscriptTab onRegenerate={handleRegenerate} />
          </div>
        ) : (
          <GeneratePanel onGenerate={() => console.log("Generate Subtitles clicked")} />
        )}
      </div>
    </div>
  );
}
