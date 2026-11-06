"use client";

import React from "react";
import { useVideoStore } from "../../store/videoStore";

const POPULAR_LANGUAGES = ["Hindi", "English", "Urdu", "Tamil", "Marathi"];

export default function LanguageChips() {
  const { language, setLanguage, setStyle } = useVideoStore();

  const handleSelect = (lang: string) => {
    setLanguage(lang);
    if (lang === "English") {
      setStyle("roman");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {POPULAR_LANGUAGES.map((lang) => {
        const isSelected = language.toLowerCase() === lang.toLowerCase();
        return (
          <button
            key={lang}
            type="button"
            onClick={() => handleSelect(lang)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              isSelected
                ? "border border-[var(--accent-strong)] bg-[#FDEBDD] text-ink"
                : "border border-[var(--border)] bg-white text-muted hover:border-[var(--accent)] hover:text-ink"
            }`}
          >
            {lang}
          </button>
        );
      })}
    </div>
  );
}
