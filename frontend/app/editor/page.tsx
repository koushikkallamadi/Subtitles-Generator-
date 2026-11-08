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
import { backendUrl, fetchProject, fetchProjectCues, patchProject, saveProjectCues } from "../../lib/projects";
import { useAuth } from "../../components/AuthProvider";
import { DottedLines } from "../../components/brand/BrandUI";

export default function EditorPage() {
  return <Suspense fallback={<div className="grid h-screen place-items-center bg-[#0b0f1a] text-sm text-gray-300">Loading project…</div>}><EditorContent /></Suspense>;
}

function EditorContent() {
  const router = useRouter();
  const queryProjectId = useSearchParams().get("project");
  const { user, loading: authLoading, requireLogin, refreshUser } = useAuth();
  const store = useVideoStore();
  const { videoUrl, projectName, duration: storeDuration, cues, timingOffset } = store;
  const projectId = queryProjectId || store.projectId;
  const userId = user?.id;
  const requireLoginRef = useRef(requireLogin);
  requireLoginRef.current = requireLogin;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(storeDuration || 0);
  const [projectLoading, setProjectLoading] = useState(true);
  const [mediaMissing, setMediaMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const saveRevision = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (projectId && !userId) {
      setProjectLoading(false);
      void requireLoginRef.current(undefined, `/editor?project=${encodeURIComponent(projectId)}`);
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
      const currentState = useVideoStore.getState();
      const localPreviewUrl = currentState.localVideoFile
        ? (currentState.videoUrl?.startsWith("blob:") ? currentState.videoUrl : URL.createObjectURL(currentState.localVideoFile))
        : null;
      useVideoStore.setState({
        projectId: project.id, videoUrl: localPreviewUrl || (project.media_available ? `${backendUrl}/media/${project.id}` : null),
        projectName: project.title || project.file_name, fileSize: project.size, duration: project.duration,
        language: project.language, style: project.style, cues: mappedCues, originalCues: mappedCues.map((cue) => ({ ...cue, words: cue.words?.map((word) => ({ ...word })) })),
        captionStyle: validateCaptionStyle(settings.captionStyle || DEFAULT_CAPTION_STYLE),
        selectedCaptionPreset: detectCaptionPreset(validateCaptionStyle(settings.captionStyle || DEFAULT_CAPTION_STYLE)),
        timingOffset: Math.max(-1, Math.min(1, Number(settings.timingOffset ?? 0))), maxWordsPerLine: Number(settings.maxWordsPerLine ?? 2), maxLinesPerSubtitle: Number(settings.maxLinesPerSubtitle ?? 2), savingState: "saved",
      });
      useVideoStore.getState().setProjectMedia(project.media_available, project.audio_available ?? false);
      setDuration(project.duration || 0);
      setMediaMissing(!project.media_available && !currentState.localVideoFile);
      setProjectLoading(false);
    }).catch((error) => {
      if (!cancelled) { setLoadError(error instanceof Error ? error.message : "Could not load project."); setProjectLoading(false); }
    });
    return () => { cancelled = true; };
  }, [router, projectId, authLoading, userId]);

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
    setLoadError("");
    if (store.videoUrl?.startsWith("blob:")) URL.revokeObjectURL(store.videoUrl);
    const localUrl = URL.createObjectURL(file);
    useVideoStore.setState({ videoUrl: localUrl, localVideoFile: file, fileSize: file.size, projectName: file.name });
    setMediaMissing(false);
    event.currentTarget.value = "";
  };

  if (projectLoading) return <div className="marketing-theme grid h-screen place-items-center text-sm text-muted">Loading project…</div>;
  if (mediaMissing) return <div className="marketing-theme flex h-screen flex-col"><TopBar theme="editor" projectName={projectName} savingState={store.savingState} /><main className="m-auto w-full max-w-lg rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-lg"><h1 className="text-lg font-semibold text-ink">Your video is on this device</h1><p className="mt-2 text-sm text-muted">Your saved subtitles are ready. Pick the video again to preview it; it stays local until you export.</p><label className="brand-button brand-button-primary mt-5 inline-flex cursor-pointer">Pick your video<input type="file" accept="video/*" className="hidden" onChange={(event) => void recoverMissingMedia(event)} /></label>{loadError && <p role="alert" className="mt-3 text-sm text-red-700">{loadError}</p>}</main></div>;
  if (loadError && !videoUrl) return <div className="marketing-theme grid h-screen place-items-center text-sm text-red-700">{loadError}</div>;
  if (!videoUrl) {
    return null;
  }

  return (
    <div className="editor-theme marketing-theme relative flex h-screen flex-col overflow-hidden bg-[#FAF8F5] text-ink">
      <TopBar theme="editor" projectName={projectName} savingState={store.savingState} />
      <DottedLines className="editor-accent-lines" />
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: Video preview, TransportBar, Timeline */}
        <main className="relative z-10 flex flex-1 flex-col h-full overflow-hidden bg-white">
          {/* Video preview (flex-1, min-h-0, shrinks) */}
          <div className="editor-preview-well flex flex-1 min-h-0 items-center justify-center p-4 overflow-hidden">
            <div className="relative flex h-full max-h-full w-full items-center justify-center rounded-2xl bg-[#111111] overflow-hidden shadow-xl ring-1 ring-black/10">
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
          <div className="w-full bg-white px-4 pb-2">
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
          <div className="transcript-theme relative z-10 flex min-w-0 flex-col h-full w-[26rem] border-l border-[var(--border)] bg-white p-3 text-ink">
            <TranscriptTab onRegenerate={handleRegenerate} />
          </div>
        ) : (
          <GeneratePanel onGenerate={() => console.log("Generate Subtitles clicked")} />
        )}
      </div>
    </div>
  );
}
