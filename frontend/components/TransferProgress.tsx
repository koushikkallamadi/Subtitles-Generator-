"use client";

import type { TransferProgress as TransferProgressData } from "../lib/uploadRequest";

function bytes(value: number) {
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function time(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Estimating time…";
  if (value < 60) return `${Math.ceil(value)} sec left`;
  return `${Math.floor(value / 60)} min ${Math.ceil(value % 60)} sec left`;
}

export default function TransferProgress({ progress, label = "Uploading video" }: { progress: TransferProgressData | null; label?: string }) {
  if (!progress) return null;
  return <div className="mt-4 rounded-xl border border-[#D65A26]/30 bg-[#FDEBDD]/60 p-3 text-left" role="status" aria-live="polite">
    <div className="flex items-center justify-between gap-3 text-xs font-semibold text-ink">
      <span>{progress.waking ? "Waking up the server…" : label}</span>
      {!progress.waking && progress.total > 0 && <span>{progress.percent}%</span>}
    </div>
    {!progress.waking && <>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#D65A26]/15"><div className="h-full rounded-full bg-[#D65A26] transition-[width]" style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }} /></div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px] text-muted">
        <span>{bytes(progress.loaded)}{progress.total ? ` / ${bytes(progress.total)}` : " sent"}</span>
        <span>{progress.bytesPerSecond ? `${bytes(progress.bytesPerSecond)}/s` : "Starting…"}</span>
        <span>{time(progress.secondsRemaining)}</span>
      </div>
    </>}
  </div>;
}
