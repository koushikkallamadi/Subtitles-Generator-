"use client";

import Link from "next/link";
import { History, Gem } from "lucide-react";
import { useState } from "react";
import HistoryDrawer from "./HistoryDrawer";
import { useAuth } from "./AuthProvider";
import { Logo, LogoMark } from "./brand/BrandUI";

interface TopBarProps {
  projectName?: string;
  savingState?: 'saved' | 'unsaved' | 'saving' | 'error';
  showHistory?: boolean;
  theme?: 'dark' | 'marketing' | 'editor';
}

export default function TopBar({ projectName, savingState = 'saved', showHistory, theme = 'dark' }: TopBarProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { user, requireLogin, logout } = useAuth();
  const historyAvailable = showHistory ?? Boolean(projectName);
  const marketing = theme === 'marketing';
  const editor = theme === 'editor';
  return (
    <header className={`relative z-10 flex items-center justify-between border-b select-none ${marketing || editor ? 'h-16 border-[var(--border)] bg-white px-5 text-ink sm:px-7' : 'h-14 border-gray-800 bg-[#0f1422] px-6'}`}>
      {/* Left side: Logo & Project Name */}
      <div className="flex items-center space-x-3">
        <Link href="/" aria-label="Padalu home" className="flex items-center">{marketing || editor ? <Logo markSize="sm" /> : <LogoMark size="sm" />}</Link>
        {!marketing && <div className={`ml-3 flex flex-col border-l pl-4 ${editor ? 'border-[var(--border)]' : 'border-gray-700'}`}>
          <span className={`max-w-[36vw] truncate text-sm font-semibold leading-tight ${editor ? 'text-ink' : 'text-white'}`}>{projectName || "Untitled project"}</span>
          <span className={`mt-0.5 text-[11px] font-normal leading-tight ${editor ? 'text-muted' : 'text-gray-500'}`}>{savingState === 'unsaved' ? 'Unsaved caption changes' : savingState === 'saving' ? 'Saving…' : savingState === 'error' ? 'Could not save changes' : 'All changes saved'}</span>
        </div>}
      </div>

      {/* Right side: Actions & User */}
      <div className="flex items-center space-x-3">
        <Link
          href="/"
          className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition ${marketing || editor ? 'border-[var(--border)] bg-white text-ink hover:bg-[var(--accent-soft)]' : 'border-gray-800/80 bg-[#171d2b] text-gray-200 hover:bg-gray-800 hover:text-white'}`}
        >
          <span className="text-gray-400 font-bold mr-0.5">+</span> New
        </Link>

        {user && historyAvailable && <button
          type="button"
          onClick={() => void requireLogin(() => setHistoryOpen(true), '/')}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${marketing || editor ? 'border-[var(--border)] bg-white text-ink hover:bg-[var(--accent-soft)]' : 'border-gray-800/80 bg-[#171d2b] text-gray-200 hover:bg-gray-800 hover:text-white'}`}
        >
          <History className="h-3.5 w-3.5 text-gray-400" />
          <span>History</span>
        </button>}

        {user && <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${marketing || editor ? 'border-[var(--border)] bg-white text-[var(--accent-strong)]' : 'border-gray-800/80 bg-[#171d2b] text-[#f26543]'}`}>
          <Gem className={`h-3.5 w-3.5 ${marketing || editor ? 'text-[var(--accent-strong)]' : 'text-[#f26543]'}`} />
          <span>{user.credits}</span>
        </div>}
        {user ? <div className="relative">
          <button type="button" aria-label="Account menu" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)} className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white ${marketing || editor ? 'bg-[var(--accent-strong)] ring-1 ring-black/10' : 'bg-[#e0694f] ring-1 ring-white/20'}`}>
            {user.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" /> : user.name.slice(0, 1).toUpperCase()}
          </button>
          {accountOpen && <div className={`absolute right-0 top-10 z-40 w-64 rounded-xl border p-3 shadow-2xl ${marketing || editor ? 'border-[var(--border)] bg-white' : 'border-gray-700 bg-[#171b24]'}`}>
            <p className={`truncate text-sm font-semibold ${marketing || editor ? 'text-ink' : 'text-white'}`}>{user.name}</p><p className={`truncate text-xs ${marketing || editor ? 'text-muted' : 'text-gray-400'}`}>{user.email}</p><p className={`mt-2 text-xs ${marketing || editor ? 'text-[var(--accent-strong)]' : 'text-[#e07860]'}`}>{user.credits} credits</p>
            <button type="button" onClick={() => { setAccountOpen(false); void logout().then(() => window.location.assign('/')); }} className={`mt-3 w-full rounded-lg border px-3 py-2 text-left text-xs ${marketing || editor ? 'border-[var(--border)] text-ink hover:bg-[var(--accent-soft)]' : 'border-gray-700 text-gray-200 hover:bg-white/5'}`}>Sign out</button>
          </div>}
        </div> : <button type="button" onClick={() => void requireLogin(undefined, '/') } className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${marketing || editor ? 'border-ink text-ink hover:bg-[var(--accent-soft)]' : 'border-gray-700 text-gray-200 hover:border-[#e07860] hover:text-white'}`}>Sign in</button>}
      </div>
      {historyOpen && <HistoryDrawer onClose={() => setHistoryOpen(false)} />}
    </header>
  );
}
