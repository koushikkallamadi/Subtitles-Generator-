"use client";

import Link from "next/link";
import { History, Gem } from "lucide-react";
import { useState } from "react";
import HistoryDrawer from "./HistoryDrawer";
import { useAuth } from "./AuthProvider";

interface TopBarProps {
  projectName?: string;
  savingState?: 'saved' | 'unsaved' | 'saving' | 'error';
  showHistory?: boolean;
}

export default function TopBar({ projectName, savingState = 'saved', showHistory }: TopBarProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { user, requireLogin, logout } = useAuth();
  const historyAvailable = showHistory ?? Boolean(projectName);
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
            {savingState === 'unsaved' ? 'Unsaved caption changes' : savingState === 'saving' ? 'Saving…' : savingState === 'error' ? 'Could not save changes' : 'All changes saved'}
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

        {user && historyAvailable && <button
          type="button"
          onClick={() => void requireLogin(() => setHistoryOpen(true), '/')}
          className="flex items-center gap-1.5 rounded-full bg-[#171d2b] border border-gray-800/80 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-gray-800 hover:text-white"
        >
          <History className="h-3.5 w-3.5 text-gray-400" />
          <span>History</span>
        </button>}

        {user && <div className="flex items-center gap-1.5 rounded-full bg-[#171d2b] border border-gray-800/80 px-3 py-1.5 text-xs font-medium text-[#f26543]">
          <Gem className="h-3.5 w-3.5 text-[#f26543]" />
          <span>{user.credits}</span>
        </div>}
        {user ? <div className="relative">
          <button type="button" aria-label="Account menu" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)} className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#e0694f] text-xs font-bold text-white ring-1 ring-white/20">
            {user.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" /> : user.name.slice(0, 1).toUpperCase()}
          </button>
          {accountOpen && <div className="absolute right-0 top-10 z-40 w-64 rounded-xl border border-gray-700 bg-[#171b24] p-3 shadow-2xl">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p><p className="truncate text-xs text-gray-400">{user.email}</p><p className="mt-2 text-xs text-[#e07860]">{user.credits} credits</p>
            <button type="button" onClick={() => { setAccountOpen(false); void logout().then(() => window.location.assign('/')); }} className="mt-3 w-full rounded-lg border border-gray-700 px-3 py-2 text-left text-xs text-gray-200 hover:bg-white/5">Sign out</button>
          </div>}
        </div> : <button type="button" onClick={() => void requireLogin(undefined, '/') } className="rounded-full border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 hover:border-[#e07860] hover:text-white">Sign in</button>}
      </div>
      {historyOpen && <HistoryDrawer onClose={() => setHistoryOpen(false)} />}
    </header>
  );
}
