"use client";

import Link from "next/link";
import { History, Gem } from "lucide-react";
import { useState } from "react";
import HistoryDrawer from "./HistoryDrawer";

interface TopBarProps {
  projectName?: string;
  savingState?: 'saved' | 'saving' | 'error';
}

export default function TopBar({ projectName, savingState = 'saved' }: TopBarProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-800 bg-[#0f1422] px-6 select-none">
      {/* Left side: Logo & Project Name */}
      <div className="flex items-center space-x-3">
        <Link href="/" className="flex items-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e0694f] text-xs font-black text-white shadow-md">
            DS
          </div>
        </Link>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white leading-tight">
            {projectName || "Untitled project"}
          </span>
          <span className="text-[11px] text-gray-500 font-normal leading-tight mt-0.5">
            {savingState === 'saving' ? 'Saving…' : savingState === 'error' ? 'Could not save changes' : 'All changes saved'}
          </span>
        </div>
      </div>

      {/* Right side: Actions & User */}
      <div className="flex items-center space-x-3">
        <Link
          href="/"
          className="flex items-center gap-1 rounded-full bg-[#171d2b] border border-gray-800/80 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-gray-800 hover:text-white"
        >
          <span className="text-gray-400 font-bold mr-0.5">+</span> New
        </Link>

        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-[#171d2b] border border-gray-800/80 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-gray-800 hover:text-white"
        >
          <History className="h-3.5 w-3.5 text-gray-400" />
          <span>History</span>
        </button>

        <div className="flex items-center gap-1.5 rounded-full bg-[#171d2b] border border-gray-800/80 px-3 py-1.5 text-xs font-medium text-[#f26543]">
          <Gem className="h-3.5 w-3.5 text-[#f26543]" />
          <span>24</span>
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e6c280] text-xs font-bold text-[#422909] shadow-sm ring-1 ring-amber-400/30 overflow-hidden cursor-pointer hover:opacity-90 transition">
          <svg
            className="w-5 h-5 text-amber-900"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
      </div>
      {historyOpen && <HistoryDrawer onClose={() => setHistoryOpen(false)} />}
    </header>
  );
}
