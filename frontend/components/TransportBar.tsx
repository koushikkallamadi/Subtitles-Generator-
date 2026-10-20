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
    <div className="flex w-full items-center gap-4 px-4 py-3 bg-[#0d121f]/90 border border-gray-800 rounded-xl backdrop-blur-md">
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={onTogglePlay}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-md transition hover:bg-orange-600 active:scale-95"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5 fill-current" />
        ) : (
          <Play className="h-5 w-5 fill-current ml-0.5" />
        )}
      </button>

      {/* Timecode */}
      <span className="font-mono text-xs text-gray-300 select-none flex-shrink-0">
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
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-700 accent-orange-500 hover:bg-gray-600 transition"
      />

      {/* Volume Icon */}
      <div className="flex items-center text-gray-400 hover:text-white transition flex-shrink-0">
        <Volume2 className="h-5 w-5" />
      </div>
    </div>
  );
}
