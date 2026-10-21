"use client";

import React from "react";
import { useVideoStore } from "../../store/videoStore";
import { LANGUAGES } from "./types";

export default function StyleCards() {
  const { language, style, setStyle } = useVideoStore();

  const currentOption =
    LANGUAGES.find((l) => l.name.toLowerCase() === language.toLowerCase()) ||
    LANGUAGES.find((l) => l.name === "Hindi")!;

  const isEnglish = currentOption.name === "English";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-gray-300">Style</span>

      <div className={`grid gap-2.5 ${isEnglish ? "grid-cols-1" : "grid-cols-2"}`}>
        {/* Card 1: Romanized version */}
        <button
          type="button"
          onClick={() => setStyle("roman")}
          className={`flex flex-col items-start justify-center rounded-2xl p-3 text-left transition ${
            style === "roman" || isEnglish
              ? "border border-[#f26543] bg-[#1a1720]/70 shadow-sm"
              : "border border-gray-800/80 bg-[#141824] hover:border-gray-700"
          }`}
        >
          <div className="flex items-center gap-1.5 w-full">
            <span className="text-xs font-semibold text-gray-200 truncate">
              {currentOption.romanName}
            </span>
            {currentOption.isDesi && (
              <span className="rounded bg-orange-950/60 px-1 py-0.2 text-[9px] font-bold tracking-wider text-orange-400 border border-orange-500/30">
                DESI
              </span>
            )}
          </div>
          <span className="mt-1 text-[11px] text-gray-400 truncate">
            {currentOption.romanDetail}
          </span>
        </button>

        {/* Card 2: Native script version (only if not English) */}
        {!isEnglish && (
          <button
            type="button"
            onClick={() => setStyle("native")}
            className={`flex flex-col items-start justify-center rounded-2xl p-3 text-left transition ${
              style === "native"
                ? "border border-[#f26543] bg-[#1a1720]/70 shadow-sm"
                : "border border-gray-800/80 bg-[#141824] hover:border-gray-700"
            }`}
          >
            <span className="text-xs font-semibold text-gray-200 truncate">
              {currentOption.nativeName || currentOption.name}
            </span>
            <span className="mt-1 text-[11px] text-gray-400 truncate">
              {currentOption.nativeDetail || "Native script"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
