"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useVideoStore } from "../../store/videoStore";
import TopBar from "../../components/TopBar";
import GeneratePanel from "../../components/GeneratePanel";
import TransportBar from "../../components/TransportBar";
import Timeline from "../../components/Timeline";

export default function EditorPage() {
  const router = useRouter();
  const { videoUrl, projectName, duration: storeDuration, cues, timingOffset } = useVideoStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(storeDuration || 0);

  const activeCue = cues?.find(
    (c) => currentTime >= (c.start + timingOffset - 0.1) && currentTime <= (c.end + timingOffset)
  );

  useEffect(() => {
    if (!videoUrl) {
      router.push("/");
    }
  }, [videoUrl, router]);

  useEffect(() => {
    if (storeDuration && !duration) {
      setDuration(storeDuration);
    }
  }, [storeDuration, duration]);
useEffect(() => {
  let rafId: number;
  const update = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
    rafId = requestAnimationFrame(update);
  };
  if (isPlaying) {
    rafId = requestAnimationFrame(update);
  }
  return () => {
    if (rafId) cancelAnimationFrame(rafId);
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

  if (!videoUrl) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0b0f1a] text-white">
      <TopBar projectName={projectName} />
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: Video preview, TransportBar, Timeline */}
        <main className="flex flex-1 flex-col h-full overflow-hidden">
          {/* Video preview (flex-1, min-h-0, shrinks) */}
          <div className="flex flex-1 min-h-0 items-center justify-center p-4 bg-black/40 overflow-hidden">
            <div className="relative flex h-full max-h-full w-full items-center justify-center rounded-2xl bg-black overflow-hidden shadow-2xl">
              <video
                ref={videoRef}
                src={videoUrl}

                onLoadedMetadata={() => {
                  if (videoRef.current?.duration) {
                    setDuration(videoRef.current.duration);
                    useVideoStore.setState({ duration: videoRef.current.duration });
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="h-full w-full object-contain"
              />

              {/* Live Subtitle Overlay */}
              {activeCue && (
                <div className="pointer-events-none absolute bottom-6 left-6 right-6 flex justify-center text-center z-10">
                  <span className="inline-block rounded-lg bg-black/80 px-4 py-2 text-base md:text-lg font-bold text-white shadow-2xl backdrop-blur-md border border-white/10 tracking-wide transition-all">
                    {activeCue.text}
                  </span>
                </div>
              )}
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
        <GeneratePanel onGenerate={() => console.log("Generate Subtitles clicked")} />
      </div>
    </div>
  );
}
