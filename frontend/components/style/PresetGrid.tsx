import { useState } from 'react';
import { Check, SlidersHorizontal, X } from 'lucide-react';
import type { CaptionStyle } from '../../lib/captionStyle';
import { CAPTION_PRESETS } from '../../lib/captionPresets';
import type { CaptionPreset } from '../../lib/captionPresets';
import CaptionRenderer from './CaptionRenderer';

function Sample({ preset }: { preset: CaptionPreset }) {
  const sampleWords = preset.sample.split(/\s+/).map((text, index) => ({ text, start: index * .3, end: (index + 1) * .3 }));
  const sampleStyle = preset.style;
  return <div className="flex h-24 items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_50%_42%,#383B45_0%,#17191F_74%)] px-2.5" style={{ containerType: 'inline-size' }}>
    <CaptionRenderer style={sampleStyle} text={preset.sample} words={sampleWords} activeWordIndex={preset.activeWordIndex ?? 0} revealedWordIndex={sampleWords.length - 1} containerSize={{ width: 260, height: 320 }} />
  </div>;
}

export default function PresetGrid({ selected, onSelect }: { selected: string; onSelect: (preset: CaptionStyle) => void }) {
  const [open, setOpen] = useState(false);
  const renderCard = (preset: CaptionPreset) => {
    const isSelected = selected === preset.name;
    return <button type="button" key={preset.name} onClick={() => { onSelect(preset.style); setOpen(false); }} aria-pressed={isSelected} className={`group flex h-[166px] min-w-0 flex-col rounded-2xl border-2 p-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D65A26] ${isSelected ? 'border-[#D65A26] bg-[#FFF3EA] shadow-[0_5px_18px_rgba(214,90,38,.16)]' : 'border-[#E6E1DB] bg-white hover:border-[#D65A26] hover:bg-[#FFFCFA]'}`}>
      <div className="relative w-full">
        <Sample preset={preset} />
        {isSelected && <span className="preset-selected-badge absolute right-2 top-[-8px] z-10 inline-flex items-center gap-1 rounded-full bg-[#D65A26] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm"><Check size={11} strokeWidth={3} />Selected</span>}
      </div>
      <div className="mt-2 flex min-h-10 w-full items-start justify-between gap-1 px-1">
        <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold leading-4 text-gray-200" title={preset.name}>{preset.name}</div><div className="mt-0.5 truncate text-[10px] leading-3 text-gray-500" title={preset.description}>{preset.description}</div></div>
        {preset.name === 'Custom' && <SlidersHorizontal size={14} className="shrink-0 text-gray-400" />}
      </div>
    </button>;
  };
  return <section className="space-y-3">
    <SectionHeading eyebrow="1. CHOOSE A LOOK" title="Premium caption presets" />
    <div className="grid grid-cols-2 gap-2.5">{CAPTION_PRESETS.slice(0, 8).map(renderCard)}</div>
    <div className="flex justify-center pt-1"><button type="button" onClick={() => setOpen(true)} className="browse-styles-button rounded-full border border-[#D65A26] bg-[#D65A26] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#B8501F]">Browse all styles ↗</button></div>
    {open && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-label="Browse all styles" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-700 bg-[#171a21] p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#dc735c]">Explore</p><h3 className="mt-1 text-lg font-semibold">All styles</h3></div><button type="button" onClick={() => setOpen(false)} aria-label="Close styles" className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"><X size={18} /></button></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{CAPTION_PRESETS.map(renderCard)}</div>
      </div>
    </div>}
  </section>;
}

export function SectionHeading({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return <div className="flex items-center justify-between border-b border-[#F2C7AE] pb-3"><div><p className="text-xs font-semibold tracking-wide text-[#dc735c]">{eyebrow}</p><h2 className="mt-0.5 text-sm font-semibold text-gray-100">{title}</h2></div>{right}</div>;
}



