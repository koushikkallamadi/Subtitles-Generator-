import { DEFAULT_STYLE, captionStylesEqual, validateCaptionStyle } from './captionStyle';
import type { CaptionStyle } from './captionStyle';

export type CaptionPreset = { name: string; sample: string; description: string; style: CaptionStyle };
const preset = (name: string, patch: Record<string, unknown>): CaptionStyle => validateCaptionStyle({ ...DEFAULT_STYLE, ...patch,
  position: { ...DEFAULT_STYLE.position, ...((patch.position as object) || {}) },
  highlight: { ...DEFAULT_STYLE.highlight, ...((patch.highlight as object) || {}) }, reveal: { ...DEFAULT_STYLE.reveal, ...((patch.reveal as object) || {}) },
  stroke: { ...DEFAULT_STYLE.stroke, ...((patch.stroke as object) || {}) }, background: { ...DEFAULT_STYLE.background, ...((patch.background as object) || {}) },
});

export const CAPTION_PRESETS: CaptionPreset[] = [
  { name: 'Highlight', sample: "Hey what's up", description: 'Poppins word highlight', style: preset('Highlight', { fontFamily: 'Poppins' }) },
  { name: 'Reveal', sample: "Hey what's up", description: 'TikTok Sans word reveal', style: preset('Reveal', { fontFamily: 'TikTok Sans', highlight: { enabled: false }, reveal: { enabled: true }, animation: 'fade' }) },
  { name: 'Minimal', sample: "Hey what's up", description: 'Clean Inter captions', style: preset('Minimal', { fontFamily: 'Inter', textColor: '#f3f4f6', bold: true, highlight: { enabled: false } }) },
  { name: 'Cinema', sample: "Hey what's up", description: 'Anton with a soft panel', style: preset('Cinema', { fontFamily: 'Anton', background: { enabled: true, color: '#111318', opacity: 88, paddingPx: 12, radius: 7 }, highlight: { enabled: false }, animation: 'fade' }) },
  { name: 'Bubble', sample: "Hey what's up", description: 'Rounded Baloo pop', style: preset('Bubble', { fontFamily: 'Baloo 2', textColor: '#e8557c', background: { enabled: true, color: '#fffafa', opacity: 100, paddingPx: 15, radius: 24 }, highlight: { enabled: false } }) },
  { name: 'Script', sample: 'Make every word feel', description: 'Expressive lettering', style: preset('Script', { fontFamily: 'Caveat', textColor: '#7ed5ee', italic: true, highlight: { enabled: false }, scale: 115 }) },
  { name: 'Duo', sample: 'Make every word feel', description: 'Anton + Caveat emphasis', style: preset('Duo', { fontFamily: 'Anton', alternateFontFamily: 'Caveat', textColor: '#fff2f0', highlight: { enabled: true, textColor: '#fff', boxColor: '#e8795f' }, reveal: { enabled: true }, animation: 'popIn' }) },
  { name: 'Custom', sample: 'Your style', description: 'Build your own look', style: preset('Custom', { fontFamily: 'Noto Sans', textColor: '#f3f4f6', highlight: { enabled: false }, background: { enabled: true, opacity: 45 } }) },
  { name: 'Creator Classic', sample: "Hey what's up", description: 'Bold Montserrat + highlight', style: preset('Creator Classic', { fontFamily: 'Montserrat', bold: true, highlight: { enabled: true } }) },
  { name: 'Bold Hook', sample: 'MAKE IT COUNT', description: 'Condensed Oswald pop', style: preset('Bold Hook', { fontFamily: 'Oswald', scale: 130, animation: 'popIn', highlight: { enabled: false } }) },
  { name: 'Neon Pop', sample: 'Make it happen', description: 'Bright accent word', style: preset('Neon Pop', { fontFamily: 'League Spartan', textColor: '#f4f5ff', highlight: { enabled: true, textColor: '#101010', boxColor: '#b7ff3c' }, reveal: { enabled: true }, animation: 'slideUp' }) },
  { name: 'Editorial', sample: 'A little more story', description: 'Lora with subtle framing', style: preset('Editorial', { fontFamily: 'Lora', italic: true, textColor: '#f7eddd', highlight: { enabled: false }, background: { enabled: true, opacity: 72, radius: 4 } }) },
];
export const PRESET_BY_NAME = Object.fromEntries(CAPTION_PRESETS.map((item) => [item.name, item.style])) as Record<string, CaptionStyle>;
export function detectCaptionPreset(style: CaptionStyle): string {
  return CAPTION_PRESETS.find((item) => captionStylesEqual(style, item.style))?.name || 'Custom';
}
