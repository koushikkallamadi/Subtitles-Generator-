import React from 'react';
import { AlertTriangle, Clock3, Link2, MoreHorizontal, Play, Unlink2 } from 'lucide-react';
import { Cue, useVideoStore } from '../store/videoStore';

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds), h = Math.floor(safe / 3600), m = Math.floor((safe % 3600) / 60), s = Math.floor(safe % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(Math.floor((safe % 1) * 1000)).padStart(3, '0')}`;
};
const parseTime = (value: string) => {
  const parts = value.split(':');
  if (parts.length !== 3) return Number(value);
  return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
};

export default function CueCard({ cue, index, current = false }: { cue: Cue; index: number; current?: boolean }) {
  const store = useVideoStore();
  const [text, setText] = React.useState(cue.text);
  const [start, setStart] = React.useState(formatTime(cue.start));
  const [end, setEnd] = React.useState(formatTime(cue.end));
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [timeError, setTimeError] = React.useState('');
  const textarea = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => { setText(cue.text); setStart(formatTime(cue.start)); setEnd(formatTime(cue.end)); }, [cue.text, cue.start, cue.end]);
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const wordCount = lines.reduce((longest, line) => Math.max(longest, line.split(/\s+/).filter(Boolean).length), 0);
  const invalidLimits = lines.length > store.maxLinesPerSubtitle || wordCount > store.maxWordsPerLine;
  const selected = current || store.selectedCueIndex === index;
  const commitTiming = () => {
    const nextStart = parseTime(start), nextEnd = parseTime(end);
    const timingChanged = Number.isFinite(nextStart) && Number.isFinite(nextEnd) && (Math.abs(nextStart - cue.start) > 0.001 || Math.abs(nextEnd - cue.end) > 0.001);
    if (!timingChanged) { setTimeError(''); return; }
    if (!Number.isFinite(nextStart) || !Number.isFinite(nextEnd) || nextEnd <= nextStart) { setTimeError('End time must be after start time.'); setStart(formatTime(cue.start)); setEnd(formatTime(cue.end)); return; }
    if (nextEnd - nextStart < 0.3) { setTimeError('Cue must be at least 0.3 seconds long.'); setStart(formatTime(cue.start)); setEnd(formatTime(cue.end)); return; }
    const previous = store.cues[index - 1], next = store.cues[index + 1];
    if (previous && nextStart < previous.end - 0.01) { setTimeError('This cue overlaps the previous cue.'); setStart(formatTime(cue.start)); setEnd(formatTime(cue.end)); return; }
    if (next && nextEnd > next.start + 0.01) { setTimeError('This cue overlaps the next cue.'); setStart(formatTime(cue.start)); setEnd(formatTime(cue.end)); return; }
    setTimeError('');
    if (Math.abs(nextStart - cue.start) > 0.001 || Math.abs(nextEnd - cue.end) > 0.001) store.updateCue(index, { start: nextStart, end: nextEnd });
  };
  const clickCard = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('button,input,textarea')) return;
    store.setSelectedCue(index);
    const video = document.querySelector('video');
    if (video) { video.currentTime = Math.max(0, cue.start + store.timingOffset); video.dispatchEvent(new Event('timeupdate')); }
  };
  const linesText = text.split(/\s+/).filter(Boolean).reduce((result, word, i) => {
    const lineIndex = Math.floor(i / store.maxWordsPerLine);
    result[lineIndex] = result[lineIndex] ? `${result[lineIndex]} ${word}` : word;
    return result;
  }, [] as string[]).join('\n');
  return <article data-cue-index={index} onClick={clickCard} className={`relative rounded-2xl border bg-[#191c22] p-3 transition-colors ${invalidLimits ? 'border-l-2 border-l-amber-400 border-gray-700' : selected ? 'border-[#dc735c]' : 'border-gray-700/80'} ${selected ? 'shadow-[0_0_0_1px_rgba(220,115,92,.13)]' : ''}`}>
    <header className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">{invalidLimits && <AlertTriangle size={14} className="text-amber-400" />}
        <button onClick={() => { store.setSelectedCue(index); const video = document.querySelector('video'); if (video) { video.currentTime = Math.max(0, cue.start + store.timingOffset); video.dispatchEvent(new Event('timeupdate')); } }} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${selected ? 'bg-[#dc735c] text-[#201613]' : 'bg-[#22252c] text-gray-300'}`}><Play size={12} fill="currentColor" /> Cue {index + 1}</button>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <button onClick={() => store.setLinked(index, !cue.linked)} className="flex items-center gap-1 hover:text-white" title="Toggle linked">{cue.linked ? <Link2 size={14} /> : <Unlink2 size={14} />}<span>{cue.linked ? 'Linked' : 'Unlinked'}</span></button>
        <span className="flex items-center gap-1 rounded-full bg-[#23262d] px-2 py-1"><Clock3 size={13} />{Math.max(0, cue.end - cue.start).toFixed(1)}s</span>
        <div className="relative"><button aria-label="Cue actions" onClick={() => setMenuOpen(!menuOpen)} className="rounded p-1 hover:bg-white/10"><MoreHorizontal size={17} /></button>
          {menuOpen && <div className="absolute right-0 top-7 z-20 min-w-36 rounded-lg border border-gray-700 bg-[#22252c] p-1 shadow-xl">
            <button className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-white/10" onClick={() => { store.deleteCue(index); setMenuOpen(false); }}>Delete</button>
            <button className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-white/10 disabled:opacity-40" disabled={index === store.cues.length - 1} onClick={() => { store.mergeCueWithNext(index); setMenuOpen(false); }}>Merge with next</button>
            <button className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-white/10" onClick={() => { store.addCueAfter(index); setMenuOpen(false); }}>Add cue after</button>
            <button className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-white/10" onClick={() => { store.splitCue(index, text, textarea.current?.selectionStart || Math.floor(text.length / 2)); setMenuOpen(false); }}>Split at cursor</button>
          </div>}</div>
      </div>
    </header>
    <div className="mb-1 grid grid-cols-2 gap-2 rounded-xl border border-gray-700/70 bg-[#1b1e24] p-2">
      <label className="text-[10px] font-semibold tracking-wide text-gray-400">START<input aria-label="Start time" value={start} onChange={(e) => setStart(e.target.value)} onBlur={commitTiming} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTiming(); e.currentTarget.blur(); } }} className="mt-1 block w-full rounded-full bg-[#26292f] px-2 py-2 font-mono text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#dc735c]" /></label>
      <label className="text-[10px] font-semibold tracking-wide text-gray-400">END<input aria-label="End time" value={end} onChange={(e) => setEnd(e.target.value)} onBlur={commitTiming} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTiming(); e.currentTarget.blur(); } }} className="mt-1 block w-full rounded-full bg-[#26292f] px-2 py-2 font-mono text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#dc735c]" /></label>
    </div>
    {timeError && <p role="alert" className="mb-2 px-1 text-xs text-red-400">{timeError}</p>}
    <textarea ref={textarea} value={text} onChange={(e) => { setText(e.target.value); store.updateCue(index, { text: e.target.value }); }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }} onFocus={(e) => { if (e.currentTarget.value === cue.text) setText(linesText); }} rows={Math.max(2, Math.min(4, lines.length || 2))} className="w-full resize-y rounded-xl border border-gray-700/70 bg-[#22252b] px-3 py-2 text-sm leading-6 text-gray-100 outline-none focus:border-gray-500" />
    <footer className="mt-2 flex items-center justify-between text-xs"><span className={lines.length > store.maxLinesPerSubtitle ? 'text-amber-300' : 'text-gray-400'}>{lines.length} / {store.maxLinesPerSubtitle} lines</span><span className={wordCount > store.maxWordsPerLine ? 'text-amber-300' : 'text-gray-400'}>{wordCount} / {store.maxWordsPerLine} words</span></footer>
  </article>;
}
