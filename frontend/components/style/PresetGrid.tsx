import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import type { CaptionStyle } from '../../lib/captionStyle';
import { CAPTION_PRESETS } from '../../lib/captionPresets';
import type { CaptionPreset } from '../../lib/captionPresets';
import CaptionRenderer from './CaptionRenderer';

function Sample({ preset }: { preset: CaptionPreset }) {
  const sampleWords = preset.sample.split(/\s+/).map((text, index) => ({ text, start: index * .3, end: (index + 1) * .3 }));
  const sampleStyle = preset.style;
  return <div className="flex h-20 items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_center,#30333d_0%,#14161b_78%)] px-2" style={{ containerType: 'inline-size' }}>
    <CaptionRenderer style={sampleStyle} text={preset.sample} words={sampleWords} activeWordIndex={0} containerSize={{ width: 260, height: 320 }} />
  </div>;
}

export default function PresetGrid({ selected, onSelect }: { selected: string; onSelect: (preset: CaptionStyle) => void }) {
  const [open, setOpen] = useState(false);
  const renderCard = (preset: CaptionPreset) => <button type="button" key={preset.name} onClick={() => { onSelect(preset.style); setOpen(false); }} aria-pressed={selected === preset.name} className={`group rounded-[20px] border p-2 text-left transition hover:border-[#dc735c]/70 ${selected === preset.name ? 'border-[#dc735c] shadow-[0_0_0_1px_rgba(220,115,92,.2)]' : 'border-gray-700/70 bg-[#17191f]'}`}>
    <Sample preset={preset} />
    <div className="mt-2 flex items-center justify-between px-1"><div><div className="text-xs font-semibold text-gray-200">{preset.name}</div><div className="mt-0.5 text-[10px] text-gray-500">{preset.description}</div></div>{preset.name === 'Custom' && <SlidersHorizontal size={14} className="text-gray-400" />}</div>
  </button>;

  return <section className="space-y-3">
    <SectionHeading eyebrow="1. CHOOSE A LOOK" title="Style presets" />
    <div className="grid grid-cols-2 gap-2.5">{CAPTION_PRESETS.slice(0, 8).map(renderCard)}</div>
    <div className="flex justify-center pt-1"><button type="button" onClick={() => setOpen(true)} className="rounded-full border border-[#dc735c] px-3.5 py-2 text-xs font-semibold text-gray-100 transition hover:bg-[#dc735c]/10">Browse all styles ↗</button></div>
    {open && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-label="Browse all styles" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-700 bg-[#171a21] p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#dc735c]">Explore</p><h3 className="mt-1 text-lg font-semibold">All styles</h3></div><button type="button" onClick={() => setOpen(false)} aria-label="Close styles" className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"><X size={18} /></button></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{CAPTION_PRESETS.map(renderCard)}</div>
      </div>
    </div>}
  </section>;
}

export function SectionHeading({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return <div className="flex items-center justify-between border-b border-gray-700/70 pb-3"><div><p className="text-xs font-semibold tracking-wide text-[#dc735c]">{eyebrow}</p><h2 className="mt-0.5 text-sm font-semibold text-gray-100">{title}</h2></div>{right}</div>;
}



