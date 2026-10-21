"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Info, Film, X } from "lucide-react";
import { useVideoStore } from "../../store/videoStore";

export default function SourceCard() {
  const router = useRouter();
  const { projectName, fileSize, clearVideo } = useVideoStore();

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearVideo();
    router.push("/");
  };

  const formattedSize =
    fileSize > 1000
      ? (fileSize / (1024 * 1024)).toFixed(1)
      : fileSize > 0
      ? fileSize.toFixed(1)
      : "8.4";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
        <span>Source</span>
        <Info className="h-3.5 w-3.5 text-gray-500" />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-800/80 bg-[#141824] p-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-gray-800 bg-[#0f131f] text-gray-400">
            <Film className="h-5 w-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate text-xs font-medium text-gray-200">
              {projectName || "media_01 (4).mp4"}
            </span>
            <span className="truncate text-[11px] text-gray-400">
              Your video is ready to be processed · {formattedSize} MB
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRemove}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-800 hover:text-white"
          title="Remove video"
          aria-label="Remove video"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
