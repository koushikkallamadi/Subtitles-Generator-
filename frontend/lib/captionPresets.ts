import { DEFAULT_PREMIUM_CONFIG, DEFAULT_STYLE, captionStylesEqual, validateCaptionStyle } from './captionStyle';
import type { CaptionStyle } from './captionStyle';

export type CaptionPreset = { name: string; sample: string; description: string; style: CaptionStyle; activeWordIndex?: number };
const preset = (name: string, patch: Record<string, unknown>): CaptionStyle => validateCaptionStyle({ ...DEFAULT_STYLE, ...patch,
  position: { ...DEFAULT_STYLE.position, ...((patch.position as object) || {}) },
  highlight: { ...DEFAULT_STYLE.highlight, ...((patch.highlight as object) || {}) }, reveal: { ...DEFAULT_STYLE.reveal, ...((patch.reveal as object) || {}) },
  wordEmphasis: { ...DEFAULT_STYLE.wordEmphasis, ...((patch.wordEmphasis as object) || {}) },
  premium: { ...DEFAULT_PREMIUM_CONFIG, ...((patch.premium as object) || {}) },
  stroke: { ...DEFAULT_STYLE.stroke, ...((patch.stroke as object) || {}) }, background: { ...DEFAULT_STYLE.background, ...((patch.background as object) || {}) },
});

const legacyCaptionPresets: CaptionPreset[] = [
  // Keep the familiar Poppins karaoke highlight as the first, featured preset.
  { name: 'Highlight', sample: "Hey what's up", description: 'Poppins · word-by-word highlight', style: preset('Highlight', { fontFamily: 'Poppins' }) },
  { name: 'Devin Jatho', sample: 'all done automatically', activeWordIndex: 2, description: 'Poppins · one-word violet glow', style: preset('Devin Jatho', { fontFamily: 'Poppins', bold: false, scale: 118, textColor: '#F8F7FF', highlight: { enabled: false, textColor: '#171717', boxColor: '#765CFF', boxOpacity: 0, boxRadius: 0 }, wordEmphasis: { enabled: false, scale: 1.36, letterSpacingEm: 0.012, textColor: '#6652FF', glowColor: '#5638FF', glowBlurPx: 22, strokeColor: '#B8ACFF', strokeWidthPx: 0.75 } }) },
  { name: 'Impact Pop', sample: 'Make it count', description: 'Anton · punchy pop animation', style: preset('Impact Pop', { fontFamily: 'Anton', scale: 118, highlight: { enabled: true, textColor: '#171717', boxColor: '#FF8A45', boxOpacity: 100, boxRadius: 4 }, animation: 'popIn' }) },
  { name: 'Creator Clean', sample: 'Every word lands', description: 'TikTok Sans · crisp minimal type', style: preset('Creator Clean', { fontFamily: 'TikTok Sans', scale: 105, highlight: { enabled: true, textColor: '#10231F', boxColor: '#65E6C7', boxRadius: 5 }, animation: 'fade' }) },
  { name: 'Karaoke Flow', sample: 'Stay for the story', description: 'Follow-along word reveal', style: preset('Karaoke Flow', { fontFamily: 'League Spartan', scale: 108, highlight: { enabled: true, textColor: '#171717', boxColor: '#FFD166', boxRadius: 5 }, reveal: { enabled: true }, animation: 'slideUp' }) },
  { name: 'Soft Bar', sample: 'Clear words. No noise.', description: 'Inter · refined caption panel', style: preset('Soft Bar', { fontFamily: 'Inter', bold: false, textColor: '#FFFFFF', highlight: { enabled: false }, background: { enabled: true, color: '#111318', opacity: 84, paddingPx: 14, radius: 14 }, animation: 'fade' }) },
  { name: 'Punchline', sample: 'Wait for the twist', description: 'Bangers · bold creator energy', style: preset('Punchline', { fontFamily: 'Bangers', scale: 112, highlight: { enabled: true, textColor: '#FFFFFF', boxColor: '#E94F37', boxRadius: 5 }, animation: 'popIn' }) },
  { name: 'Mint Focus', sample: 'Say it with confidence', description: 'Montserrat · fresh mint accent', style: preset('Mint Focus', { fontFamily: 'Montserrat', scale: 102, highlight: { enabled: true, textColor: '#101C19', boxColor: '#8AF0C5', boxRadius: 6 }, animation: 'zoomIn' }) },
  { name: 'Quiet Pro', sample: 'Made for your audience', description: 'Inter · clean, high-contrast type', style: preset('Quiet Pro', { fontFamily: 'Inter', scale: 96, highlight: { enabled: false }, animation: 'fade' }) },
  { name: 'Editorial', sample: 'A little more story', description: 'Lora · polished storytelling', style: preset('Editorial', { fontFamily: 'Lora', italic: true, scale: 104, textColor: '#FFF4E8', highlight: { enabled: false }, background: { enabled: true, color: '#17120F', opacity: 78, paddingPx: 12, radius: 8 }, animation: 'fade' }) },
  { name: 'Night Mode', sample: 'Big ideas, clearly', description: 'Oswald · sharp and cinematic', style: preset('Night Mode', { fontFamily: 'Oswald', scale: 110, highlight: { enabled: true, textColor: '#111318', boxColor: '#F3F1EB', boxRadius: 3 }, animation: 'slideUp' }) },
  { name: 'Marker Note', sample: 'Make every word feel', description: 'Caveat · handwritten emphasis', style: preset('Marker Note', { fontFamily: 'Caveat', italic: true, scale: 125, textColor: '#FFF8EE', highlight: { enabled: true, textColor: '#171717', boxColor: '#FFB347', boxRadius: 3 }, animation: 'popIn' }) },
  { name: 'Custom', sample: 'Your style', description: 'Make a signature look of your own', style: preset('Custom', { fontFamily: 'Noto Sans', textColor: '#f3f4f6', highlight: { enabled: false }, background: { enabled: true, opacity: 45 } }) },
];

const premiumDefaults = { ...DEFAULT_PREMIUM_CONFIG, enabled: true };
export const PREMIUM_PRESET: CaptionPreset = {
  name: 'Premium', sample: 'endukante ee unit prices', activeWordIndex: 3, description: 'Stacked focus · editable color, glow and sweep',
  style: preset('Premium', {
    fontFamily: 'Poppins', bold: false,
    highlight: { enabled: false, textColor: '#171717', boxColor: '#5638FF', boxOpacity: 0, boxRadius: 0 },
    premium: { ...premiumDefaults, accentColor: '#5638FF', gradientEnabled: false, accentGradient: ['#1F4BFF', '#3FA0FF'], glowColor: '#5B8CFF', glowLinkedToGradient: false },
  }),
};
export const PREMIUM_PRESETS: CaptionPreset[] = [PREMIUM_PRESET];

export const CAPTION_PRESETS: CaptionPreset[] = [...PREMIUM_PRESETS, ...legacyCaptionPresets];
export const PRESET_BY_NAME = Object.fromEntries(CAPTION_PRESETS.map((item) => [item.name, item.style])) as Record<string, CaptionStyle>;
export function detectCaptionPreset(style: CaptionStyle): string {
  return CAPTION_PRESETS.find((item) => captionStylesEqual(style, item.style))?.name || 'Custom';
}
