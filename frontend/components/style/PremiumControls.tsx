import { Palette } from 'lucide-react';
import type { PremiumCaptionConfig } from '../../lib/captionStyle';

const inputClass = 'h-8 min-w-0 rounded-lg border border-gray-700 bg-[#202229] px-2 text-xs text-gray-100 outline-none focus:border-[#dc735c]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[minmax(96px,1fr)_minmax(0,1.35fr)] items-center gap-2 border-b border-gray-800 py-2 text-[11px] text-gray-300">
    <span>{label}</span><span className="flex min-w-0 items-center justify-end gap-1.5">{children}</span>
  </div>;
}

function NumberField({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  return <Field label={label}><input aria-label={label} className={`${inputClass} w-24 text-right`} type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || 0)))} />{unit && <small className="text-[9px] text-gray-500">{unit}</small>}</Field>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={label}><span className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-700 bg-[#202229] px-2"><Palette size={12} className="text-gray-500" /><input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" /></span></Field>;
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <Field label={label}><input aria-label={label} type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#D65A26]" /></Field>;
}

export default function PremiumControls({ config, onChange }: { config: PremiumCaptionConfig; onChange: (patch: Partial<PremiumCaptionConfig>) => void }) {
  const setSweep = (patch: Partial<PremiumCaptionConfig['lightSweep']>) => onChange({ lightSweep: { ...config.lightSweep, ...patch } });
  const setWeight = (field: 'support' | 'emphasis', value: number) => onChange({ fontWeight: { ...config.fontWeight, [field]: value } });
  const updateGradient = (index: 0 | 1, color: string) => {
    const next: [string, string] = [...config.accentGradient];
    next[index] = color;
    onChange({ accentGradient: next });
  };

  return <details className="rounded-xl border border-[#D65A26]/40 bg-[#D65A26]/[0.06] p-3" open>
    <summary className="cursor-pointer list-none text-xs font-semibold text-[#F19A71]">Premium caption settings</summary>
    <p className="mt-1 text-[10px] text-gray-500">Tune the stacked supporting line, emphasis, sweep, and glow.</p>
    <div className="mt-2 space-y-3">
      <fieldset className="rounded-lg border border-gray-800 px-2"><legend className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Gradient and glow</legend>
        <ColorField label="Accent color" value={config.accentColor} onChange={(accentColor) => onChange({ accentColor })} />
        <ToggleField label="Gradient fill" value={config.gradientEnabled} onChange={(gradientEnabled) => onChange({ gradientEnabled })} />
        {config.gradientEnabled && <><ColorField label="Gradient start" value={config.accentGradient[0]} onChange={(color) => updateGradient(0, color)} /><ColorField label="Gradient end" value={config.accentGradient[1]} onChange={(color) => updateGradient(1, color)} /></>}
        <ToggleField label="Link glow to gradient" value={config.glowLinkedToGradient} onChange={(glowLinkedToGradient) => onChange({ glowLinkedToGradient })} />
        {!config.glowLinkedToGradient && <ColorField label="Glow color" value={config.glowColor} onChange={(glowColor) => onChange({ glowColor })} />}
        <NumberField label="Glow exposure" value={config.glowExposure} min={0} max={2} step={0.01} onChange={(glowExposure) => onChange({ glowExposure })} />
        <NumberField label="Glow radius" value={config.glowRadius} min={0.1} max={3} step={0.05} unit="×" onChange={(glowRadius) => onChange({ glowRadius })} />
      </fieldset>

      <fieldset className="rounded-lg border border-gray-800 px-2"><legend className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Light sweep</legend>
        <ToggleField label="Sweep on/off" value={config.lightSweep.enabled} onChange={(enabled) => setSweep({ enabled })} />
        <NumberField label="Sweep intensity" value={config.lightSweep.intensity} min={0} max={1} step={0.01} onChange={(intensity) => setSweep({ intensity })} />
        <NumberField label="Sweep width" value={config.lightSweep.width} min={1} max={400} unit="px / 1080w" onChange={(width) => setSweep({ width })} />
        <NumberField label="Sweep angle" value={config.lightSweep.angle} min={-180} max={180} unit="deg" onChange={(angle) => setSweep({ angle })} />
        <NumberField label="Sweep position" value={config.lightSweep.position} min={0} max={100} step={1} unit="%" onChange={(position) => setSweep({ position })} />
        <ToggleField label="Top-edge highlight" value={config.lightSweep.topEdge} onChange={(topEdge) => setSweep({ topEdge })} />
      </fieldset>

      <fieldset className="rounded-lg border border-gray-800 px-2"><legend className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Typography and layout</legend>
        <Field label="Font"><select aria-label="Premium font" className={`${inputClass} w-full`} value={config.fontFamily} onChange={(event) => onChange({ fontFamily: event.target.value })}>{['Poppins', 'Inter', 'Noto Sans', 'Noto Sans Telugu'].map((font) => <option key={font}>{font}</option>)}</select></Field>
        <NumberField label="Support weight" value={config.fontWeight.support} min={100} max={900} step={100} onChange={(value) => setWeight('support', value)} />
        <NumberField label="Emphasis weight" value={config.fontWeight.emphasis} min={100} max={900} step={100} onChange={(value) => setWeight('emphasis', value)} />
        <ColorField label="Supporting text" value={config.textColor} onChange={(textColor) => onChange({ textColor })} />
        <Field label="Case"><select aria-label="Premium case" className={`${inputClass} w-full`} value={config.caseTransform} onChange={(event) => onChange({ caseTransform: event.target.value as PremiumCaptionConfig['caseTransform'] })}>{['lowercase', 'uppercase', 'none'].map((value) => <option key={value}>{value}</option>)}</select></Field>
        <NumberField label="Text size" value={config.fontSizeBase} min={1} max={20} step={0.1} unit="% video h" onChange={(fontSizeBase) => onChange({ fontSizeBase })} />
        <NumberField label="Emphasis ratio" value={config.ratioScale} min={1.8} max={2.5} step={0.05} unit="×" onChange={(ratioScale) => onChange({ ratioScale })} />
        <NumberField label="Line gap" value={config.lineGap} min={0} max={0.4} step={0.01} unit="× line size" onChange={(lineGap) => onChange({ lineGap })} />
        <NumberField label="Vertical position" value={config.positionY} min={0} max={100} unit="%" onChange={(positionY) => onChange({ positionY })} />
        <NumberField label="Maximum width" value={config.maxWidthPercent} min={40} max={88} unit="%" onChange={(maxWidthPercent) => onChange({ maxWidthPercent })} />
        <NumberField label="Max words per chunk" value={config.wordsPerChunk.max} min={1} max={4} onChange={(max) => onChange({ wordsPerChunk: { ...config.wordsPerChunk, max } })} />
        <Field label="Emphasis word"><select aria-label="Emphasis word mode" className={`${inputClass} w-full`} value={config.emphasisStrategy} onChange={(event) => onChange({ emphasisStrategy: event.target.value as PremiumCaptionConfig['emphasisStrategy'] })}>{['last', 'longest', 'custom'].map((value) => <option key={value}>{value}</option>)}</select></Field>
        {config.emphasisStrategy === 'custom' && <Field label="Manual emphasis"><input aria-label="Manual emphasis word" className={`${inputClass} w-full`} value={config.emphasisWord} onChange={(event) => onChange({ emphasisWord: event.target.value })} /></Field>}
      </fieldset>
    </div>
  </details>;
}
