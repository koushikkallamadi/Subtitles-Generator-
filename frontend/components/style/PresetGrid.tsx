import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { CaptionStyle } from '../../store/videoStore';
import { STYLE_PRESETS, Preset } from './stylePresets';

function Sample({ preset }: { preset: Preset }) {
  const style = preset.style;
  const fontFamily = style.font === 'System' ? 'system-ui, sans-serif' : `"${style.font}", sans-serif`;
  return <div className="flex h-16 items-center justify-center rounded-xl bg-[radial-gradient(ellipse_at_center,#30333d_0%,#14161b_78%)] px-2 text-center">
    <span style={{ fontFamily, fontWeight: style.bold ? 800 : 500, fontStyle: style.italic ? 'italic' : 'normal', color: style.textColor, textShadow: style.stroke ? `1px 1px ${style.strokeColor}, -1px -1px ${style.strokeColor}` : undefined, background: style.background ? style.backgroundColor : undefined, padding: style.background ? 3 : 0, borderRadius: style.background ? 5 : undefined }} className="text-sm leading-tight">
      {preset.name === 'Duo' ? <><span style={{ fontFamily: '"Bebas Neue", sans-serif' }}>Make every </span><span className="italic" style={{ fontFamily: 'Caveat, cursive', color: '#ef8b6f' }}>word feel</span></> : style.wordHighlight ? <><span className="rounded px-0.5" style={{ color: style.highlightTextColor, backgroundColor: style.highlightBoxColor }}>Hey</span> what’s up</> : preset.sample}
    </span>
  </div>;
}

export default function PresetGrid({ selected, onSelect }: { selected: string; onSelect: (preset: CaptionStyle) => void }) {
  const [open, setOpen] = useState(false);
  const renderCard = (preset: Preset) => <button type="button" key={preset.name} onClick={() => { onSelect(preset.style); setOpen(false); }} aria-pressed={selected === preset.name} className={`group rounded-[20px] border p-2 text-left transition hover:border-[#dc735c]/70 ${selected === preset.name ? 'border-[#dc735c] shadow-[0_0_0_1px_rgba(220,115,92,.2)]' : 'border-gray-700/70 bg-[#17191f]'}`}>
    <Sample preset={preset} />
    <div className="mt-2 flex items-center justify-between px-1"><div><div className="text-xs font-semibold text-gray-200">{preset.name}</div><div className="mt-0.5 text-[10px] text-gray-500">{preset.description}</div></div>{preset.name === 'Custom' && <SlidersHorizontal size={14} className="text-gray-400" />}</div>
  </button>;

  return <section className="space-y-3">
    <SectionHeading eyebrow="1. CHOOSE A LOOK" title="Style presets" />
    <div className="grid grid-cols-2 gap-2.5">{STYLE_PRESETS.slice(0, 8).map(renderCard)}</div>
    <div className="flex justify-center pt-1"><button type="button" onClick={() => setOpen(true)} className="rounded-full border border-[#dc735c] px-3.5 py-2 text-xs font-semibold text-gray-100 transition hover:bg-[#dc735c]/10">Browse all styles ↗</button></div>
    {open && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-label="Browse all styles" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-700 bg-[#171a21] p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#dc735c]">Explore</p><h3 className="mt-1 text-lg font-semibold">All styles</h3></div><button type="button" onClick={() => setOpen(false)} aria-label="Close styles" className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"><X size={18} /></button></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{STYLE_PRESETS.map(renderCard)}</div>
      </div>
    </div>}
  </section>;
}

export function SectionHeading({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return <div className="flex items-center justify-between border-b border-gray-700/70 pb-3"><div><p className="text-xs font-semibold tracking-wide text-[#dc735c]">{eyebrow}</p><h2 className="mt-0.5 text-sm font-semibold text-gray-100">{title}</h2></div>{right}</div>;
}
