import { Info, Link2, Palette, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CaptionStyle } from '../../lib/captionStyle';
import { PRESET_BY_NAME } from '../../lib/captionPresets';
import { useVideoStore } from '../../store/videoStore';
import { SectionHeading } from './PresetGrid';

const inputClass = 'h-9 w-[64px] rounded-lg border border-gray-700 bg-[#202229] px-2 text-sm text-gray-100 outline-none focus:border-[#dc735c]';
const selectClass = 'h-9 min-w-0 flex-1 rounded-lg border border-gray-700 bg-[#202229] px-2 text-sm text-gray-100 outline-none focus:border-[#dc735c]';
const fonts = ['System', 'Noto Sans', 'Noto Sans Telugu', 'Noto Sans Devanagari', 'Noto Sans Tamil', 'TikTok Sans', 'Inter', 'Poppins', 'Montserrat', 'Anton', 'Archivo Black', 'League Spartan', 'Oswald', 'Bebas Neue', 'Baloo 2', 'Bangers', 'Lora', 'Caveat'];
const animations = [['zoomIn', 'Zoom in'], ['popIn', 'Pop in'], ['fade', 'Fade'], ['slideUp', 'Slide up'], ['typewriter', 'Typewriter'], ['none', 'None']] as const;

function Toggle({ value, onChange, label }: { value: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" aria-label={label} aria-pressed={value} onClick={() => onChange(!value)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${value ? 'bg-[#dc735c]' : 'bg-gray-700'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} /></button>;
}
function ColorInput({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <label title={label} className="flex h-9 w-11 items-center justify-center gap-1 rounded-lg border border-gray-700 bg-[#202229] px-1"><Palette size={12} className="text-gray-500" /><input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" /></label>;
}
function NumberInput({ value, onChange, label, min, max, step, unit = '' }: { value: number; onChange: (value: number) => void; label: string; min: number; max: number; step: number; unit?: string }) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setDraft(String(value)); }, [value, editing]);
  const commit = () => {
    const parsed = draft.trim() === '' ? NaN : Number(draft);
    if (!Number.isFinite(parsed)) { setDraft(String(value)); setEditing(false); return; }
    const next = Math.min(max, Math.max(min, parsed));
    onChange(next); setDraft(String(next)); setEditing(false);
  };
  return <span className="flex items-center gap-1"><input aria-label={label} type="number" min={min} max={max} step={step} value={draft}
    onFocus={() => setEditing(true)} onChange={(event) => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); event.currentTarget.blur(); } if (event.key === 'Escape') { setDraft(String(value)); setEditing(false); event.currentTarget.blur(); } }}
    className={`${inputClass} text-right`} />{unit && <span className="inline-flex h-7 min-w-5 items-center justify-center rounded border border-gray-700 bg-[#202229] px-1 text-[10px] text-gray-400">{unit}</span>}</span>;
}
function Row({ label, info, children }: { label: string; info: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[minmax(100px,1fr)_auto] items-center gap-3 py-2"><div className="flex items-center gap-1.5 text-xs font-medium text-gray-200"><span>{label}</span><span title={info}><Info size={13} className="shrink-0 text-gray-500" /></span></div><div className="flex min-w-0 items-center justify-end gap-1.5">{children}</div></div>;
}

export default function FineTunePanel({ style }: { style: CaptionStyle }) {
  const setStyle = useVideoStore((state) => state.setCaptionStyle);
  const selectedPreset = useVideoStore((state) => state.selectedCaptionPreset);
  const resetPreset = PRESET_BY_NAME[selectedPreset] || PRESET_BY_NAME.Highlight;
  return <section className="space-y-2">
    <SectionHeading eyebrow="2. FINE-TUNE" title="Customisations" right={<button type="button" onClick={() => useVideoStore.getState().applyCaptionPreset(resetPreset)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-300 hover:bg-white/5 hover:text-white"><RotateCcw size={14} />Reset</button>} />
    <div className="divide-y divide-gray-800/80">
      <Row label="Position (%)" info="Caption position as a percent of the video frame."><button type="button" onClick={() => setStyle({ linked: !style.linked })} className={`flex h-8 items-center gap-1 rounded-md px-1.5 text-[11px] ${style.linked ? 'text-gray-300' : 'text-gray-500'}`}><Link2 size={13} />{style.linked ? 'Linked' : 'Unlinked'}</button><NumberInput label="X position (%)" min={0} max={100} step={1} value={style.position.x} onChange={(x) => setStyle({ position: { x } })} /><NumberInput label="Y position (%)" min={0} max={100} step={1} value={style.position.y} onChange={(y) => setStyle({ position: { y } })} /></Row>
      <Row label="Size" info="Caption scale relative to video frame height."><NumberInput label="Size (%)" min={40} max={250} step={5} value={style.scale} unit="%" onChange={(scale) => setStyle({ scale })} /></Row>
      <Row label="Font" info="The font switches to a matching Noto font for Indian scripts when needed."><select aria-label="Font" value={style.fontFamily} onChange={(event) => setStyle({ fontFamily: event.target.value })} className={selectClass}>{fonts.map((font) => <option key={font}>{font}</option>)}</select></Row>
      <Row label="Font style" info="Set weight, slant and text colour."><button type="button" aria-pressed={style.bold} onClick={() => setStyle({ bold: !style.bold })} className={`h-9 rounded-lg border px-2 text-xs ${style.bold ? 'border-[#dc735c]/50 bg-[#dc735c]/15 text-white' : 'border-gray-700 text-gray-300'}`}><b>B</b> Bold</button><button type="button" aria-pressed={style.italic} onClick={() => setStyle({ italic: !style.italic })} className={`h-9 rounded-lg border px-2 text-xs italic ${style.italic ? 'border-[#dc735c]/50 bg-[#dc735c]/15 text-white' : 'border-gray-700 text-gray-300'}`}>I Italic</button><ColorInput label="Text colour" value={style.textColor} onChange={(textColor) => setStyle({ textColor })} /></Row>
      <Row label="Word highlight" info="Highlight the word currently being spoken."><Toggle label="Word highlight" value={style.highlight.enabled} onChange={(enabled) => setStyle({ highlight: { enabled } })} /></Row>
      {style.highlight.enabled && <Row label="Highlight colours" info="Text, box colour, opacity and corner radius."><ColorInput label="Highlight text" value={style.highlight.textColor} onChange={(textColor) => setStyle({ highlight: { textColor } })} /><ColorInput label="Highlight box" value={style.highlight.boxColor} onChange={(boxColor) => setStyle({ highlight: { boxColor } })} /><NumberInput label="Highlight opacity (%)" min={0} max={100} step={5} value={style.highlight.boxOpacity} unit="%" onChange={(boxOpacity) => setStyle({ highlight: { boxOpacity } })} /><NumberInput label="Highlight radius (px)" min={0} max={40} step={1} value={style.highlight.boxRadius} unit="px" onChange={(boxRadius) => setStyle({ highlight: { boxRadius } })} /></Row>}
      <Row label="Reveal animation" info="Show each word as its timestamp is reached."><Toggle label="Reveal animation" value={style.reveal.enabled} onChange={(enabled) => setStyle({ reveal: { enabled } })} /></Row>
      <Row label="Animation" info="Choose how captions enter the frame."><select aria-label="Animation" value={style.animation} onChange={(event) => setStyle({ animation: event.target.value as CaptionStyle['animation'] })} className={selectClass}>{animations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Row>
      <Row label="Stroke" info="Outline width is scaled in proportion to the 1080p video frame."><Toggle label="Stroke" value={style.stroke.enabled} onChange={(enabled) => setStyle({ stroke: { enabled } })} /></Row>
      {style.stroke.enabled && <Row label="Stroke settings" info="Width in pixels at 1080p and stroke colour."><NumberInput label="Stroke width (px at 1080p)" min={0} max={12} step={1} value={style.stroke.widthPx} unit="px" onChange={(widthPx) => setStyle({ stroke: { widthPx } })} /><ColorInput label="Stroke colour" value={style.stroke.color} onChange={(color) => setStyle({ stroke: { color } })} /></Row>}
      <Row label="Background" info="Add a panel behind the captions."><Toggle label="Background" value={style.background.enabled} onChange={(enabled) => setStyle({ background: { enabled } })} /></Row>
      {style.background.enabled && <Row label="Background settings" info="Background colour, opacity, padding and radius scale with the video frame."><ColorInput label="Background colour" value={style.background.color} onChange={(color) => setStyle({ background: { color } })} /><NumberInput label="Background opacity (%)" min={0} max={100} step={5} value={style.background.opacity} unit="%" onChange={(opacity) => setStyle({ background: { opacity } })} /><NumberInput label="Padding (px at 1080p)" min={0} max={40} step={1} value={style.background.paddingPx} unit="px" onChange={(paddingPx) => setStyle({ background: { paddingPx } })} /><NumberInput label="Corner radius (px at 1080p)" min={0} max={40} step={1} value={style.background.radius} unit="px" onChange={(radius) => setStyle({ background: { radius } })} /></Row>}
    </div>
  </section>;
}
