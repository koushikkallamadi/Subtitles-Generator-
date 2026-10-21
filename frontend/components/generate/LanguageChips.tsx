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
                ? "border border-[#f26543] text-white bg-transparent"
                : "border border-gray-800 bg-[#141824] text-gray-400 hover:border-gray-700 hover:text-gray-300"
            }`}
          >
            {lang}
          </button>
        );
      })}
    </div>
  );
}
