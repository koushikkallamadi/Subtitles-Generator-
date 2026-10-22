import { CaptionStyle, DEFAULT_CAPTION_STYLE } from '../../store/videoStore';

export type Preset = { name: string; sample: string; description: string; style: CaptionStyle };

const makePreset = (name: string, patch: Partial<CaptionStyle>): CaptionStyle => ({ ...DEFAULT_CAPTION_STYLE, ...patch, preset: name });

export const STYLE_PRESETS: Preset[] = [
  { name: 'Highlight', sample: 'Hey what’s up', description: 'Word highlight', style: makePreset('Highlight', { wordHighlight: true, reveal: false, background: false, animation: 'None' }) },
  { name: 'Reveal', sample: 'Hey', description: 'Word reveal', style: makePreset('Reveal', { wordHighlight: false, reveal: true, animation: 'Fade' }) },
  { name: 'Minimal', sample: 'Hey what’s up', description: 'Clean and light', style: makePreset('Minimal', { font: 'Poppins', textColor: '#d8fff3', stroke: false, wordHighlight: false, background: false, bold: false }) },
  { name: 'Cinema', sample: 'Hey what’s up', description: 'Framed captions', style: makePreset('Cinema', { font: 'Montserrat', background: true, backgroundColor: '#111318', backgroundOpacity: 94, backgroundPadding: 12, backgroundRadius: 7, wordHighlight: true, animation: 'Fade' }) },
  { name: 'Bubble', sample: 'Hey', description: 'Soft colour pop', style: makePreset('Bubble', { font: 'Poppins', textColor: '#e8557c', background: true, backgroundColor: '#fffafa', backgroundOpacity: 100, backgroundPadding: 15, backgroundRadius: 24, stroke: false, wordHighlight: false }) },
  { name: 'Script', sample: 'Make every word feel', description: 'Expressive lettering', style: makePreset('Script', { font: 'Caveat', textColor: '#7ed5ee', italic: true, wordHighlight: false, stroke: false, background: false, size: 115 }) },
  { name: 'Duo', sample: 'Make every word feel', description: 'Two-tone emphasis', style: makePreset('Duo', { font: 'Bebas Neue', textColor: '#fff2f0', wordHighlight: true, highlightTextColor: '#fff', highlightBoxColor: '#e8795f', reveal: true, animation: 'Pop in' }) },
  { name: 'Custom', sample: 'Your style', description: 'Build your own look', style: makePreset('Custom', {}) },
  { name: 'Soft Focus', sample: 'Take a moment', description: 'Gentle and clear', style: makePreset('Soft Focus', { font: 'Noto Sans', bold: false, textColor: '#f7f2ea', stroke: true, strokeWidth: 1, animation: 'Fade', wordHighlight: false }) },
  { name: 'Brightline', sample: 'Make it happen', description: 'Colour-led captions', style: makePreset('Brightline', { font: 'Montserrat', textColor: '#ffdf77', stroke: true, strokeWidth: 2, animation: 'Slide up' }) },
  { name: 'Studio', sample: 'A little more story', description: 'Editorial type', style: makePreset('Studio', { font: 'Lora', italic: true, textColor: '#f7eddd', stroke: false, background: true, backgroundOpacity: 82, backgroundRadius: 4 }) },
  { name: 'Quick Cut', sample: 'Here we go', description: 'Fast and punchy', style: makePreset('Quick Cut', { font: 'Bebas Neue', size: 112, wordHighlight: true, reveal: true, animation: 'Zoom in', background: false }) },
];

export const PRESET_BY_NAME = Object.fromEntries(STYLE_PRESETS.map((preset) => [preset.name, preset.style])) as Record<string, CaptionStyle>;
