"use client";

import React, { useState, useRef, useEffect } from "react";
import { Info, ChevronDown, Search } from "lucide-react";
import { useVideoStore } from "../../store/videoStore";
import { LANGUAGES } from "./types";

export default function LanguageSelect() {
  const { language, setLanguage, setStyle } = useVideoStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentOption =
    LANGUAGES.find((l) => l.name.toLowerCase() === language.toLowerCase()) ||
    LANGUAGES.find((l) => l.name === "Hindi")!;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredLanguages = LANGUAGES.filter((lang) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      lang.name.toLowerCase().includes(q) ||
      lang.native.toLowerCase().includes(q)
    );
  });

  const handleSelectLanguage = (langName: string) => {
    setLanguage(langName);
    if (langName === "English") {
      setStyle("roman");
    }
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="relative flex flex-col gap-2" ref={dropdownRef}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
        <span>Spoken language</span>
        <Info className="h-3.5 w-3.5 text-muted" />
      </div>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm transition hover:border-[var(--accent)] focus:outline-none"
      >
        <div className="flex items-center gap-2 truncate">
          <span className="font-medium">
            {currentOption.name}
            {currentOption.native ? ` (${currentOption.native})` : ""}
          </span>
          {currentOption.isDesi && (
            <span className="rounded bg-[#FDEBDD] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[var(--accent-strong)] border border-[var(--accent)]">
              DESI
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 flex max-h-72 flex-col rounded-xl border border-[var(--border)] bg-white shadow-2xl backdrop-blur-lg">
          <div className="border-b border-[var(--border)] p-2">
            <div className="flex items-center gap-2 rounded-lg bg-[#FAF8F5] px-2.5 py-1.5 text-xs text-muted">
              <Search className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search languages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-ink placeholder-gray-500 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1 text-xs">
            {filteredLanguages.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted">
                No languages found
              </div>
            ) : (
              filteredLanguages.map((lang) => {
                const isSelected =
                  lang.name.toLowerCase() === language.toLowerCase();
                return (
                  <button
                    key={lang.name}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.name)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition ${
                      isSelected
                        ? "bg-[#FDEBDD] text-[var(--accent-strong)] font-medium"
                        : "text-muted hover:bg-[#FAF8F5] hover:text-ink"
                    }`}
                  >
                    <span className="truncate">
                      {lang.name} {lang.native ? `(${lang.native})` : ""}
                    </span>
                    {lang.isDesi && (
                      <span className="ml-2 rounded bg-[#FDEBDD] px-1 py-0.5 text-[9px] font-bold tracking-wider text-[var(--accent-strong)] border border-[var(--accent)]">
                        DESI
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
