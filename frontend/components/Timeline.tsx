"use client";

import React, { useRef } from "react";
import {
  Scissors,
  Copy,
  Trash2,
  Link as LinkIcon,
  Type,
  Image as ImageIcon,
  Undo2,
  Redo2,
  Minus,
  Maximize,
  Plus,
  Video,
  Volume2,
} from "lucide-react";

interface TimelineProps {
  currentTime: number;
  duration: number;
  fileName?: string;
  onSeek: (time: number) => void;
}

const PIXELS_PER_SECOND = 100;

function formatShortTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function Timeline({
  currentTime,
  duration,
  fileName,
  onSeek,
}: TimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const safeDuration = duration > 0 ? duration : 6;
  const clipWidth = safeDuration * PIXELS_PER_SECOND;
  const totalRulerWidth = Math.max(clipWidth + 200, 800);
  const totalSeconds = Math.ceil(totalRulerWidth / PIXELS_PER_SECOND);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + scrollContainerRef.current.scrollLeft;
    const newTime = Math.max(0, Math.min(safeDuration, clickX / PIXELS_PER_SECOND));
    onSeek(newTime);
  };

  const playheadLeft = currentTime * PIXELS_PER_SECOND;

  return (
    <div className="flex h-[220px] w-full flex-col border-t border-gray-800 bg-[#0d121f] text-gray-300 select-none">
      {/* Toolbar row */}
      <div className="flex h-10 items-center justify-between border-b border-gray-800/80 px-4 text-xs">
        {/* Left tools */}
        <div className="flex items-center space-x-1">
          <span className="font-medium text-gray-200 mr-2 text-xs">Timeline</span>
          <div className="h-4 w-[1px] bg-gray-800 mx-1" />
          <button disabled className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40">
            <Scissors className="h-3.5 w-3.5" />
          </button>
          <button disabled className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button disabled className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button disabled className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40">
            <LinkIcon className="h-3.5 w-3.5" />
          </button>
          <button disabled className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40">
            <Type className="h-3.5 w-3.5" />
          </button>
          <button disabled className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40">
            <ImageIcon className="h-3.5 w-3.5" />
          </button>
          <div className="h-4 w-[1px] bg-gray-800 mx-1" />
          <button disabled className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40">
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button disabled className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Right zoom controls */}
        <div className="flex items-center space-x-1.5 text-gray-400">
          <span className="text-[11px] font-mono mr-1">1x</span>
          <button className="p-1 text-gray-400 hover:text-white">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button className="p-1 text-gray-400 hover:text-white">
            <Maximize className="h-3.5 w-3.5" />
          </button>
          <button className="p-1 text-gray-400 hover:text-white">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main timeline area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left track headers column (120px) */}
        <div className="flex w-[120px] flex-shrink-0 flex-col border-r border-gray-800 bg-[#0f1423] text-xs">
          {/* Header spacer aligned with ruler */}
          <div className="h-6 border-b border-gray-800/80" />

          {/* Video track header */}
          <div className="flex h-12 items-center justify-between px-3 border-b border-gray-800/60">
            <div className="flex items-center space-x-1.5 truncate">
              <Video className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate text-gray-300 font-medium">Video</span>
            </div>
            <Volume2 className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
          </div>

          {/* Subtitles track header */}
          <div className="flex h-12 items-center px-3 border-b border-gray-800/60">
            <span className="text-gray-400 font-medium truncate">Subtitles</span>
          </div>
        </div>

        {/* Right scrollable tracks and ruler area */}
        <div
          ref={scrollContainerRef}
          onClick={handleContainerClick}
          className="relative flex-1 overflow-x-auto overflow-y-hidden cursor-pointer"
        >
          <div
            style={{ width: `${totalRulerWidth}px` }}
            className="relative h-full"
          >
            {/* Ruler row */}
            <div className="relative h-6 border-b border-gray-800 bg-[#0c101c]">
              {Array.from({ length: totalSeconds }).map((_, sec) => (
                <div
                  key={sec}
                  style={{ left: `${sec * PIXELS_PER_SECOND}px` }}
                  className="absolute top-0 h-full flex flex-col justify-end"
                >
                  <span className="text-[10px] font-mono text-gray-500 pl-1 leading-none">
                    {formatShortTime(sec)}
                  </span>
                  <div className="h-1.5 w-[1px] bg-gray-700" />
                </div>
              ))}
            </div>

            {/* Video track row */}
            <div className="relative h-12 border-b border-gray-800/60 py-1.5 px-0.5 bg-[#0b0f1a]/50">
              <div
                style={{ width: `${clipWidth}px` }}
                className="group relative flex h-full flex-col justify-center rounded-lg border border-blue-500/40 bg-gradient-to-r from-blue-950/70 to-indigo-950/60 px-2.5 text-white shadow-sm overflow-hidden"
              >
                <span className="truncate text-[11px] font-medium leading-tight">
                  {fileName || "Video Clip"}
                </span>
                <span className="text-[10px] text-gray-400 leading-tight">
                  0:00 - {formatShortTime(safeDuration)}
                </span>
              </div>
            </div>

            {/* Subtitles track row */}
            <div className="relative h-12 border-b border-gray-800/60 bg-[#0b0f1a]/30" />

            {/* Playhead */}
            <div
              style={{ left: `${playheadLeft}px` }}
              className="pointer-events-none absolute top-0 bottom-0 z-20 flex flex-col items-center"
            >
              {/* Playhead Head (Triangle/Pill) */}
              <div className="h-3 w-3 bg-orange-500 rounded-sm rotate-45 -mt-1 shadow-md" />
              {/* Playhead Line */}
              <div className="w-[2px] flex-1 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
