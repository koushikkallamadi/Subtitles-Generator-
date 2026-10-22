import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { useVideoStore } from '../store/videoStore';

function SettingRow({ label, hint, chip, value, min, max, step = 1, onChange }: { label: string; hint: string; chip: string; value: number; min: number; max?: number; step?: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    if (!draft.trim() || !Number.isFinite(parsed)) { setDraft(String(value)); return; }
    const next = Math.max(min, Math.min(max ?? Number.POSITIVE_INFINITY, parsed));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  return <label className="flex min-h-11 items-center justify-between gap-2 px-3 text-[13px] text-gray-200">
    <span className="flex items-center gap-1.5">{label}<span title={hint}><Info size={13} className="text-gray-400" /></span></span>
    <span className="flex h-8 items-center overflow-hidden rounded border border-gray-700 bg-[#191c23]">
      <span className="grid h-full w-8 place-items-center border-r border-gray-700 text-xs text-gray-400">{chip}</span>
      <input aria-label={label} title={hint} type="number" value={draft} min={min} max={max} step={step} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); event.currentTarget.blur(); } }} className="h-full w-14 appearance-auto bg-transparent px-1 text-center font-mono text-sm text-white outline-none" />
    </span>
  </label>;
}

export default function SettingsPanel({ onResegment }: { onResegment: (maxWords: number, lines: number) => void }) {
  const { timingOffset, setTimingOffset, maxWordsPerLine, maxLinesPerSubtitle } = useVideoStore();
  return <div className="divide-y divide-gray-800/80 bg-[#171a20] py-1">
    <SettingRow label="Timing offset" hint="Shift subtitle timing in seconds. Negative values are allowed." chip="S" value={timingOffset} min={-60} max={60} step={0.01} onChange={setTimingOffset} />
    <SettingRow label="Max words per line" hint="Maximum words shown on one subtitle line." chip="#" value={maxWordsPerLine} min={1} max={10} onChange={(value) => onResegment(Math.max(1, Math.min(10, value)), maxLinesPerSubtitle)} />
    <SettingRow label="Lines per Subtitle" hint="Maximum lines shown in one subtitle cue." chip="L" value={maxLinesPerSubtitle} min={1} max={3} onChange={(value) => onResegment(maxWordsPerLine, Math.max(1, Math.min(3, value)))} />
  </div>;
}
