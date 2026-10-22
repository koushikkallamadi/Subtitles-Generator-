export type CaptionAnimation = 'zoomIn' | 'popIn' | 'fade' | 'slideUp' | 'typewriter' | 'none';
export type WordTimestamp = { text: string; start: number; end: number };

export type CaptionStyle = {
  position: { x: number; y: number };
  linked: boolean;
  scale: number;
  fontFamily: string;
  /** Optional second font used by the Duo preset. */
  alternateFontFamily: string | null;
  bold: boolean;
  italic: boolean;
  textColor: string;
  highlight: { enabled: boolean; textColor: string; boxColor: string; boxOpacity: number; boxRadius: number };
  reveal: { enabled: boolean };
  animation: CaptionAnimation;
  stroke: { enabled: boolean; widthPx: number; color: string };
  background: { enabled: boolean; color: string; opacity: number; paddingPx: number; radius: number };
};

export type CaptionStylePatch = Partial<Omit<CaptionStyle, 'position' | 'highlight' | 'reveal' | 'stroke' | 'background'>> & {
  position?: Partial<CaptionStyle['position']>;
  highlight?: Partial<CaptionStyle['highlight']>;
  reveal?: Partial<CaptionStyle['reveal']>;
  stroke?: Partial<CaptionStyle['stroke']>;
  background?: Partial<CaptionStyle['background']>;
};

export const BASE_FONT_HEIGHT_RATIO = 0.045;
export const DEFAULT_STYLE: CaptionStyle = {
  position: { x: 50, y: 86 }, linked: true, scale: 100, fontFamily: 'System', alternateFontFamily: null,
  bold: true, italic: false, textColor: '#ffffff',
  highlight: { enabled: true, textColor: '#171717', boxColor: '#f5d95d', boxOpacity: 100, boxRadius: 3 },
  reveal: { enabled: false }, animation: 'none',
  stroke: { enabled: false, widthPx: 3, color: '#111111' },
  background: { enabled: false, color: '#111111', opacity: 75, paddingPx: 10, radius: 10 },
};

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const color = (value: unknown, fallback: string) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
const bool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
const animationSet = new Set<CaptionAnimation>(['zoomIn', 'popIn', 'fade', 'slideUp', 'typewriter', 'none']);

/** Migrate old flat style objects, then normalize every field and unit. */
export function validateCaptionStyle(input: unknown): CaptionStyle {
  const value = input && typeof input === 'object' ? input as Record<string, any> : {};
  const old = !value.position && ('x' in value || 'size' in value || 'font' in value);
  const position = old ? { x: value.x, y: value.y } : value.position || {};
  const highlight = old ? { enabled: value.wordHighlight, textColor: value.highlightTextColor, boxColor: value.highlightBoxColor, boxOpacity: value.highlightOpacity } : value.highlight || {};
  const stroke = old ? { enabled: value.stroke, widthPx: value.strokeWidth, color: value.strokeColor } : value.stroke || {};
  const background = old ? { enabled: value.background, color: value.backgroundColor, opacity: value.backgroundOpacity, paddingPx: value.backgroundPadding, radius: value.backgroundRadius } : value.background || {};
  const rawAnimation = old ? ({ 'Zoom in': 'zoomIn', 'Pop in': 'popIn', Fade: 'fade', 'Slide up': 'slideUp', Typewriter: 'typewriter', None: 'none' } as Record<string, string>)[value.animation] : value.animation;
  const candidate = animationSet.has(rawAnimation) ? rawAnimation as CaptionAnimation : DEFAULT_STYLE.animation;
  return {
    position: { x: clamp(position.x, 0, 100, DEFAULT_STYLE.position.x), y: clamp(position.y, 0, 100, DEFAULT_STYLE.position.y) },
    linked: bool(old ? value.linked : value.linked, DEFAULT_STYLE.linked),
    scale: clamp(old ? value.size : value.scale, 40, 250, DEFAULT_STYLE.scale),
    fontFamily: typeof (old ? value.font : value.fontFamily) === 'string' ? (old ? value.font : value.fontFamily) : DEFAULT_STYLE.fontFamily,
    alternateFontFamily: typeof value.alternateFontFamily === 'string' ? value.alternateFontFamily : null,
    bold: bool(value.bold, DEFAULT_STYLE.bold), italic: bool(value.italic, DEFAULT_STYLE.italic), textColor: color(value.textColor, DEFAULT_STYLE.textColor),
    highlight: {
      enabled: bool(highlight.enabled, DEFAULT_STYLE.highlight.enabled), textColor: color(highlight.textColor, DEFAULT_STYLE.highlight.textColor),
      boxColor: color(highlight.boxColor, DEFAULT_STYLE.highlight.boxColor), boxOpacity: clamp(highlight.boxOpacity, 0, 100, DEFAULT_STYLE.highlight.boxOpacity),
      boxRadius: clamp(highlight.boxRadius, 0, 40, DEFAULT_STYLE.highlight.boxRadius),
    },
    reveal: { enabled: bool(old ? value.reveal : value.reveal?.enabled, DEFAULT_STYLE.reveal.enabled) }, animation: candidate,
    stroke: { enabled: bool(stroke.enabled, DEFAULT_STYLE.stroke.enabled), widthPx: clamp(stroke.widthPx, 0, 12, DEFAULT_STYLE.stroke.widthPx), color: color(stroke.color, DEFAULT_STYLE.stroke.color) },
    background: {
      enabled: bool(background.enabled, DEFAULT_STYLE.background.enabled), color: color(background.color, DEFAULT_STYLE.background.color),
      opacity: clamp(background.opacity, 0, 100, DEFAULT_STYLE.background.opacity), paddingPx: clamp(background.paddingPx, 0, 40, DEFAULT_STYLE.background.paddingPx),
      radius: clamp(background.radius, 0, 40, DEFAULT_STYLE.background.radius),
    },
  };
}

export function mergeCaptionStyle(current: CaptionStyle, patch: CaptionStylePatch): CaptionStyle {
  return validateCaptionStyle({ ...current, ...patch,
    position: { ...current.position, ...patch.position }, highlight: { ...current.highlight, ...patch.highlight },
    reveal: { ...current.reveal, ...patch.reveal }, stroke: { ...current.stroke, ...patch.stroke }, background: { ...current.background, ...patch.background },
  });
}

export function captionStylesEqual(a: CaptionStyle, b: CaptionStyle): boolean {
  return JSON.stringify(validateCaptionStyle(a)) === JSON.stringify(validateCaptionStyle(b));
}

export function scaleToFontPixels(scale: number, frameHeight: number): number {
  return Math.max(1, frameHeight * BASE_FONT_HEIGHT_RATIO * clamp(scale, 40, 250, 100) / 100);
}
export function positionToPixels(position: CaptionStyle['position'], frame: { width: number; height: number }) {
  const safe = validateCaptionStyle({ ...DEFAULT_STYLE, position }).position;
  return { x: frame.width * safe.x / 100, y: frame.height * safe.y / 100 };
}
export function strokeToPixels(widthPx: number, frameHeight: number) { return clamp(widthPx, 0, 12, 3) * frameHeight / 1080; }

export function fontForText(font: string, text: string): string {
  if (/[\u0c00-\u0c7f]/.test(text)) return 'Noto Sans Telugu';
  if (/[\u0900-\u097f]/.test(text)) return 'Noto Sans Devanagari';
  if (/[\u0b80-\u0bff]/.test(text)) return 'Noto Sans Tamil';
  return font;
}
export function cssFontFamily(font: string): string {
  return font === 'System' ? 'system-ui, sans-serif' : font === 'Caveat' ? 'Caveat, cursive' : `"${font}", sans-serif`;
}
