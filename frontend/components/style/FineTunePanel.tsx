import { Info, Link2, Palette, RotateCcw } from 'lucide-react';
import { CaptionStyle, useVideoStore } from '../../store/videoStore';
import { PRESET_BY_NAME } from './stylePresets';
import { SectionHeading } from './PresetGrid';

const inputClass = 'h-9 w-[64px] rounded-lg border border-gray-700 bg-[#202229] px-2 text-sm text-gray-100 outline-none focus:border-[#dc735c]';
const selectClass = 'h-9 min-w-0 flex-1 rounded-lg border border-gray-700 bg-[#202229] px-2 text-sm text-gray-100 outline-none focus:border-[#dc735c]';
const fonts = ['System', 'Noto Sans', 'Noto Sans Telugu', 'Noto Sans Devanagari', 'Noto Sans Tamil', 'Poppins', 'Montserrat', 'Bebas Neue', 'Lora', 'Caveat'];

function Toggle({ value, onChange, label }: { value: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" aria-label={label} aria-pressed={value} onClick={() => onChange(!value)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${value ? 'bg-[#dc735c]' : 'bg-gray-700'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} /></button>;
}

function ColorInput({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <label title={label} className="flex h-9 w-11 items-center justify-center gap-1 rounded-lg border border-gray-700 bg-[#202229] px-1"><Palette size={12} className="text-gray-500" /><input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" /></label>;
}

function NumberInput({ value, onChange, label, min = 0, max = 100, unit = '' }: { value: number; onChange: (value: number) => void; label: string; min?: number; max?: number; unit?: string }) {
  return <label className="relative flex items-center"><input aria-label={label} type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || 0)))} className={`${inputClass} pr-7 text-right`} /><span className="pointer-events-none absolute right-2 text-[10px] text-gray-500">{unit}</span></label>;
}

function Row({ label, info, children }: { label: string; info: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[minmax(100px,1fr)_auto] items-center gap-3 py-2"><div className="flex items-center gap-1.5 text-xs font-medium text-gray-200"><span>{label}</span><span title={info}><Info size={13} className="shrink-0 text-gray-500" /></span></div><div className="flex min-w-0 items-center justify-end gap-1.5">{children}</div></div>;
}

export default function FineTunePanel({ style }: { style: CaptionStyle }) {
  const setStyle = useVideoStore((state) => state.setCaptionStyle);
  const resetPreset = PRESET_BY_NAME[style.preset] || PRESET_BY_NAME.Custom;
  return <section className="space-y-2">
    <SectionHeading eyebrow="2. FINE-TUNE" title="Customisations" right={<button type="button" onClick={() => useVideoStore.getState().applyCaptionPreset(resetPreset)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-300 hover:bg-white/5 hover:text-white"><RotateCcw size={14} />Reset</button>} />
    <div className="divide-y divide-gray-800/80">
      <Row label="Position" info="Caption position as a percent of the video frame."><button type="button" onClick={() => setStyle({ linked: !style.linked })} className={`flex h-8 items-center gap-1 rounded-md px-1.5 text-[11px] ${style.linked ? 'text-gray-300' : 'text-gray-500'}`}><Link2 size={13} />{style.linked ? 'Linked' : 'Unlinked'}</button><NumberInput label="X position" value={style.x} onChange={(x) => setStyle({ x })} /><NumberInput label="Y position" value={style.y} onChange={(y) => setStyle({ y })} /></Row>
      <Row label="Size" info="Caption scale relative to its default size."><NumberInput label="Size" value={style.size} min={30} max={250} unit="%" onChange={(size) => setStyle({ size })} /></Row>
      <Row label="Font" info="Choose a font with support for your subtitle script."><select aria-label="Font" value={style.font} onChange={(event) => setStyle({ font: event.target.value })} className={selectClass}>{fonts.map((font) => <option key={font}>{font}</option>)}</select></Row>
      <Row label="Font style" info="Set weight, slant and text colour."><button type="button" aria-pressed={style.bold} onClick={() => setStyle({ bold: !style.bold })} className={`h-9 rounded-lg border px-2 text-xs ${style.bold ? 'border-[#dc735c]/50 bg-[#dc735c]/15 text-white' : 'border-gray-700 text-gray-300'}`}><b>B</b> Bold</button><button type="button" aria-pressed={style.italic} onClick={() => setStyle({ italic: !style.italic })} className={`h-9 rounded-lg border px-2 text-xs italic ${style.italic ? 'border-[#dc735c]/50 bg-[#dc735c]/15 text-white' : 'border-gray-700 text-gray-300'}`}>I Italic</button><ColorInput label="Text colour" value={style.textColor} onChange={(textColor) => setStyle({ textColor })} /></Row>
      <Row label="Word highlight" info="Highlight the word currently being spoken."><Toggle label="Word highlight" value={style.wordHighlight} onChange={(wordHighlight) => setStyle({ wordHighlight })} /></Row>
      {style.wordHighlight && <Row label="Highlight colours" info="Text, highlight box and box opacity."><ColorInput label="Highlight text" value={style.highlightTextColor} onChange={(highlightTextColor) => setStyle({ highlightTextColor })} /><ColorInput label="Highlight box" value={style.highlightBoxColor} onChange={(highlightBoxColor) => setStyle({ highlightBoxColor })} /><NumberInput label="Highlight opacity" value={style.highlightOpacity} unit="%" onChange={(highlightOpacity) => setStyle({ highlightOpacity })} /></Row>}
      <Row label="Reveal animation" info="Show each word as its timestamp is reached."><Toggle label="Reveal animation" value={style.reveal} onChange={(reveal) => setStyle({ reveal })} /></Row>
      <Row label="Animation" info="Choose how captions enter the frame."><select aria-label="Animation" value={style.animation} onChange={(event) => setStyle({ animation: event.target.value })} className={selectClass}>{['Zoom in', 'Pop in', 'Fade', 'Slide up', 'Typewriter', 'None'].map((animation) => <option key={animation}>{animation}</option>)}</select></Row>
      <Row label="Stroke" info="Add an outline to caption text."><Toggle label="Stroke" value={style.stroke} onChange={(stroke) => setStyle({ stroke })} /></Row>
      {style.stroke && <Row label="Stroke settings" info="Outline thickness and colour."><NumberInput label="Stroke width" value={style.strokeWidth} max={10} unit="px" onChange={(strokeWidth) => setStyle({ strokeWidth })} /><ColorInput label="Stroke colour" value={style.strokeColor} onChange={(strokeColor) => setStyle({ strokeColor })} /></Row>}
      <Row label="Background" info="Add a panel behind the captions."><Toggle label="Background" value={style.background} onChange={(background) => setStyle({ background })} /></Row>
      {style.background && <Row label="Background settings" info="Background colour, opacity, padding and corner radius."><ColorInput label="Background colour" value={style.backgroundColor} onChange={(backgroundColor) => setStyle({ backgroundColor })} /><NumberInput label="Background opacity" value={style.backgroundOpacity} unit="%" onChange={(backgroundOpacity) => setStyle({ backgroundOpacity })} /><NumberInput label="Padding" value={style.backgroundPadding} max={40} unit="px" onChange={(backgroundPadding) => setStyle({ backgroundPadding })} /><NumberInput label="Corner radius" value={style.backgroundRadius} max={40} unit="px" onChange={(backgroundRadius) => setStyle({ backgroundRadius })} /></Row>}
    </div>
  </section>;
}
