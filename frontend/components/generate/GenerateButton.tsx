"use client";

import React, { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useVideoStore } from "../../store/videoStore";

export default function GenerateButton() {
  const { language, style, duration } = useVideoStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const cost = Math.max(1, Math.ceil(duration / 60));

  const handleClick = () => {
    if (isGenerating) return;
    console.log("Generate Subtitles clicked:", { language, style });
    setIsGenerating(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 95;
        }
        return prev + 15;
      });
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
      }, 300);
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-2 pt-2">
      <div className="text-center text-xs text-gray-400">
        Cost: {cost} {cost === 1 ? "credit" : "credits"}
      </div>

      <button
        type="button"
        disabled={isGenerating}
        onClick={handleClick}
        className="relative overflow-hidden w-full rounded-2xl bg-[#d96b52] py-3.5 text-center font-medium text-white shadow-lg transition hover:bg-[#e0755c] active:scale-[0.99] disabled:opacity-80"
      >
        {isGenerating ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Generating...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span>Generate Subtitles</span>
          </div>
        )}

        {isGenerating && (
          <div className="absolute bottom-0 left-0 h-1 bg-white/40 transition-all duration-200"
               style={{ width: `${progress}%` }} />
        )}
      </button>
    </div>
  );
}
