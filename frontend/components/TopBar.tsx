"use client";

import Link from "next/link";

interface TopBarProps {
  projectName?: string;
}

export default function TopBar({ projectName }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-800 bg-[#0f1422] px-6">
      <div className="flex items-center space-x-3">
        <span className="font-semibold text-white">
          {projectName || "Untitled project"}
        </span>
      </div>
      <div className="flex items-center space-x-4">
        <Link
          href="/"
          className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-700"
        >
          + New
        </Link>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 text-xs font-bold text-white shadow-sm">
          CK
        </div>
      </div>
    </header>
  );
}
