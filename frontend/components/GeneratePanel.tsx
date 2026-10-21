"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import SourceCard from "./generate/SourceCard";
import LanguageSelect from "./generate/LanguageSelect";
import LanguageChips from "./generate/LanguageChips";
import StyleCards from "./generate/StyleCards";
import GenerateButton from "./generate/GenerateButton";

interface GeneratePanelProps {
  onGenerate?: () => void;
}

export default function GeneratePanel({ onGenerate }: GeneratePanelProps) {
  return (
    <aside className="flex h-full w-[380px] flex-shrink-0 flex-col justify-between border-l border-gray-800 bg-[#0d121f] select-none">
      {/* Top section: Tab & Form options */}
      <div className="flex flex-col">
        {/* Tab Header with full-width coral active underline */}
        <div className="border-b border-[#f26543] pt-4 pb-3 px-6">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-white">
            <Sparkles className="h-4 w-4 text-[#f26543]" />
            <span>Generate</span>
          </div>
        </div>

        {/* Form controls */}
        <div className="flex flex-col gap-6 p-6">
          <SourceCard />
          <div className="flex flex-col gap-3">
            <LanguageSelect />
            <LanguageChips />
          </div>
          <StyleCards />
        </div>
      </div>

      {/* Bottom section: Cost & Generate Button */}
      <div className="p-6 pt-0">
        <GenerateButton />
      </div>
    </aside>
  );
}
