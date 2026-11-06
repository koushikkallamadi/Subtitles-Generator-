"use client";

import { Play, Pause, Volume2 } from "lucide-react";

interface TransportBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

export default function TransportBar({
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  onSeek,
}: TransportBarProps) {
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSeek(Number(e.target.value));
  };

  return (
    <div className="flex w-full items-center gap-4 px-4 py-3 bg-white border border-[var(--border)] rounded-xl shadow-sm">
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={onTogglePlay}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent-strong)] text-white shadow-md transition hover:bg-[#B8501F] active:scale-95"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5 fill-current" />
        ) : (
          <Play className="h-5 w-5 fill-current ml-0.5" />
        )}
      </button>

      {/* Timecode */}
      <span className="font-mono text-xs text-muted select-none flex-shrink-0">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      {/* Scrubber slider */}
      <input
        type="range"
        min={0}
        max={duration > 0 ? duration : 0}
        step={0.01}
        value={currentTime}
        onChange={handleSliderChange}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-[#E6E1DB] accent-[#D65A26] hover:bg-[#d8d0c5] transition"
      />

      {/* Volume Icon */}
      <div className="flex items-center text-muted hover:text-ink transition flex-shrink-0">
        <Volume2 className="h-5 w-5" />
      </div>
    </div>
  );
}
