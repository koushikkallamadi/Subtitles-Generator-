export type CaptionAnimation = 'zoomIn' | 'popIn' | 'fade' | 'slideUp' | 'typewriter' | 'none';
export type WordTimestamp = { text: string; start: number; end: number };
export type PremiumCaptionConfig = {
  enabled: boolean;
  accentColor: string;
  accentGradient: [string, string];
  gradientEnabled: boolean;
  glowLinkedToGradient: boolean;
  glowExposure: number;
  glowRadius: number;
  lineGap: number;
  lightSweep: { enabled: boolean; intensity: number; width: number; angle: number; position: number; topEdge: boolean };
  backgroundBox: 'none' | 'pill' | 'rounded';
  caseTransform: 'lowercase' | 'uppercase' | 'none';
  dropShadow: { enabled: boolean; x: number; y: number; blur: number; color: string; opacity: number };
  easing: 'easeOutBack' | 'easeOut' | 'easeInOut' | 'linear';
  fontFamily: string;
  fontWeight: { support: number; emphasis: number };
  glowColor: string;
  glowBlur: number[];
  glowIntensity: number;
  highlightMode: 'word' | 'line' | 'karaoke';
  inDuration: number;
  justify: 'center' | 'left';
  karaokeFill: string;
  lineHeight: number;
  linesPerChunk: number;
  maxWidthPercent: number;
  neonLayers: number;
  outDuration: number;
  positionY: number;
  quality: number;
  ratioScale: number;
  fontSizeBase: number;
  strokeWidth: number;
  textColor: string;
  uppercaseOverride: string[];
  verticalSafeZone: { top: number; bottom: number; left: number; right: number };
  wordsPerChunk: { min: number; max: number };
  xOffset: number;
  yOffset: number;
  zIndex: { glow: number; fill: number; support: number };
  emphasisStrategy: 'last' | 'longest' | 'custom';
  emphasisWord: string;
};

export const DEFAULT_PREMIUM_CONFIG: PremiumCaptionConfig = {
  enabled: false, accentColor: '#5638FF', accentGradient: ['#5B3DF0', '#7B4FFF'], gradientEnabled: true, glowLinkedToGradient: false, glowExposure: .3, glowRadius: 1, lineGap: .08,
  lightSweep: { enabled: true, intensity: .5, width: 45, angle: -56, position: 70, topEdge: true }, backgroundBox: 'none', caseTransform: 'lowercase',
  dropShadow: { enabled: true, x: 0, y: 2, blur: 8, color: '#000000', opacity: 60 },
  easing: 'easeOutBack', fontFamily: 'Poppins', fontWeight: { support: 600, emphasis: 800 },
  glowColor: '#4F5BFF', glowBlur: [23.04, 57.6, 124.8], glowIntensity: .6, highlightMode: 'word',
  inDuration: 120, justify: 'center', karaokeFill: '#9EACFF', lineHeight: .95, linesPerChunk: 2,
  maxWidthPercent: 88, neonLayers: 4, outDuration: 80, positionY: 67, quality: 2, ratioScale: 2.05,
  fontSizeBase: 5.5, strokeWidth: 0, textColor: '#FFFFFF', uppercaseOverride: [],
  verticalSafeZone: { top: 8, bottom: 8, left: 8, right: 8 }, wordsPerChunk: { min: 2, max: 4 },
  xOffset: 0, yOffset: 0, zIndex: { glow: 0, fill: 1, support: 2 }, emphasisStrategy: 'last', emphasisWord: '',
};

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
  wordEmphasis: { enabled: boolean; scale: number; letterSpacingEm: number; textColor: string; glowColor: string; glowBlurPx: number; strokeColor: string; strokeWidthPx: number };
  premium: PremiumCaptionConfig;
  reveal: { enabled: boolean };
  animation: CaptionAnimation;
  stroke: { enabled: boolean; widthPx: number; color: string };
  background: { enabled: boolean; color: string; opacity: number; paddingPx: number; radius: number };
};

export type CaptionStylePatch = Partial<Omit<CaptionStyle, 'position' | 'highlight' | 'wordEmphasis' | 'premium' | 'reveal' | 'stroke' | 'background'>> & {
  position?: Partial<CaptionStyle['position']>;
  highlight?: Partial<CaptionStyle['highlight']>;
  wordEmphasis?: Partial<CaptionStyle['wordEmphasis']>;
  premium?: Partial<PremiumCaptionConfig> & {
    lightSweep?: Partial<PremiumCaptionConfig['lightSweep']>;
    dropShadow?: Partial<PremiumCaptionConfig['dropShadow']>;
    fontWeight?: Partial<PremiumCaptionConfig['fontWeight']>;
    verticalSafeZone?: Partial<PremiumCaptionConfig['verticalSafeZone']>;
    wordsPerChunk?: Partial<PremiumCaptionConfig['wordsPerChunk']>;
    zIndex?: Partial<PremiumCaptionConfig['zIndex']>;
  };
  reveal?: Partial<CaptionStyle['reveal']>;
  stroke?: Partial<CaptionStyle['stroke']>;
  background?: Partial<CaptionStyle['background']>;
};

export const BASE_FONT_HEIGHT_RATIO = 0.045;
export const DEFAULT_STYLE: CaptionStyle = {
  position: { x: 50, y: 86 }, linked: true, scale: 100, fontFamily: 'System', alternateFontFamily: null,
  bold: true, italic: false, textColor: '#ffffff',
  highlight: { enabled: true, textColor: '#171717', boxColor: '#f5d95d', boxOpacity: 100, boxRadius: 3 },
  wordEmphasis: { enabled: false, scale: 1.3, letterSpacingEm: 0.01, textColor: '#765CFF', glowColor: '#765CFF', glowBlurPx: 14, strokeColor: '#B9ADFF', strokeWidthPx: 0.5 },
  premium: DEFAULT_PREMIUM_CONFIG,
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
const choice = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;
const animationSet = new Set<CaptionAnimation>(['zoomIn', 'popIn', 'fade', 'slideUp', 'typewriter', 'none']);

/** Migrate old flat style objects, then normalize every field and unit. */
export function validateCaptionStyle(input: unknown): CaptionStyle {
  const value = input && typeof input === 'object' ? input as Record<string, any> : {};
  const old = !value.position && ('x' in value || 'size' in value || 'font' in value);
  const position = old ? { x: value.x, y: value.y } : value.position || {};
  const highlight = old ? { enabled: value.wordHighlight, textColor: value.highlightTextColor, boxColor: value.highlightBoxColor, boxOpacity: value.highlightOpacity } : value.highlight || {};
  const stroke = old ? { enabled: value.stroke, widthPx: value.strokeWidth, color: value.strokeColor } : value.stroke || {};
  const background = old ? { enabled: value.background, color: value.backgroundColor, opacity: value.backgroundOpacity, paddingPx: value.backgroundPadding, radius: value.backgroundRadius } : value.background || {};
  const premium = { ...DEFAULT_PREMIUM_CONFIG, ...(value.premium || {}) };
  const premiumDropShadow = { ...DEFAULT_PREMIUM_CONFIG.dropShadow, ...(value.premium?.dropShadow || {}) };
  const premiumFontWeight = { ...DEFAULT_PREMIUM_CONFIG.fontWeight, ...(value.premium?.fontWeight || {}) };
  const premiumSafeZone = { ...DEFAULT_PREMIUM_CONFIG.verticalSafeZone, ...(value.premium?.verticalSafeZone || {}) };
  const premiumWordsPerChunk = { ...DEFAULT_PREMIUM_CONFIG.wordsPerChunk, ...(value.premium?.wordsPerChunk || {}) };
  const premiumZIndex = { ...DEFAULT_PREMIUM_CONFIG.zIndex, ...(value.premium?.zIndex || {}) };
  const premiumSweep = { ...DEFAULT_PREMIUM_CONFIG.lightSweep, ...(value.premium?.lightSweep || {}) };
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
    wordEmphasis: {
      enabled: bool(value.wordEmphasis?.enabled, DEFAULT_STYLE.wordEmphasis.enabled),
      scale: clamp(value.wordEmphasis?.scale, 1, 2, DEFAULT_STYLE.wordEmphasis.scale),
      letterSpacingEm: clamp(value.wordEmphasis?.letterSpacingEm, -0.1, 0.2, DEFAULT_STYLE.wordEmphasis.letterSpacingEm),
      textColor: color(value.wordEmphasis?.textColor, DEFAULT_STYLE.wordEmphasis.textColor),
      glowColor: color(value.wordEmphasis?.glowColor, DEFAULT_STYLE.wordEmphasis.glowColor),
      glowBlurPx: clamp(value.wordEmphasis?.glowBlurPx, 0, 48, DEFAULT_STYLE.wordEmphasis.glowBlurPx),
      strokeColor: color(value.wordEmphasis?.strokeColor, DEFAULT_STYLE.wordEmphasis.strokeColor),
      strokeWidthPx: clamp(value.wordEmphasis?.strokeWidthPx, 0, 4, DEFAULT_STYLE.wordEmphasis.strokeWidthPx),
    },
    premium: {
      enabled: bool(premium.enabled, DEFAULT_PREMIUM_CONFIG.enabled),
      accentColor: color(premium.accentColor, DEFAULT_PREMIUM_CONFIG.accentColor),
      accentGradient: Array.isArray(premium.accentGradient) && premium.accentGradient.length === 2
        ? [color(premium.accentGradient[0], DEFAULT_PREMIUM_CONFIG.accentColor), color(premium.accentGradient[1], DEFAULT_PREMIUM_CONFIG.accentColor)]
        : [...DEFAULT_PREMIUM_CONFIG.accentGradient],
      gradientEnabled: bool(premium.gradientEnabled, Boolean(premium.accentGradient)),
      glowLinkedToGradient: bool(premium.glowLinkedToGradient, DEFAULT_PREMIUM_CONFIG.glowLinkedToGradient),
      glowExposure: clamp(premium.glowExposure, 0, 2, DEFAULT_PREMIUM_CONFIG.glowExposure),
      glowRadius: clamp(premium.glowRadius, 0.1, 3, DEFAULT_PREMIUM_CONFIG.glowRadius),
      lineGap: clamp(premium.lineGap, 0, 0.4, DEFAULT_PREMIUM_CONFIG.lineGap),
      lightSweep: {
        enabled: bool(premiumSweep.enabled, DEFAULT_PREMIUM_CONFIG.lightSweep.enabled),
        intensity: clamp(premiumSweep.intensity, 0, 1, DEFAULT_PREMIUM_CONFIG.lightSweep.intensity),
        width: clamp(premiumSweep.width, 1, 400, DEFAULT_PREMIUM_CONFIG.lightSweep.width),
        angle: clamp(premiumSweep.angle, -180, 180, DEFAULT_PREMIUM_CONFIG.lightSweep.angle),
        position: clamp(premiumSweep.position, 0, 100, DEFAULT_PREMIUM_CONFIG.lightSweep.position),
        topEdge: bool(premiumSweep.topEdge, DEFAULT_PREMIUM_CONFIG.lightSweep.topEdge),
      },
      backgroundBox: choice(premium.backgroundBox, ['none', 'pill', 'rounded'] as const, DEFAULT_PREMIUM_CONFIG.backgroundBox),
      caseTransform: choice(premium.caseTransform, ['lowercase', 'uppercase', 'none'] as const, DEFAULT_PREMIUM_CONFIG.caseTransform),
      dropShadow: {
        enabled: bool(premiumDropShadow.enabled, DEFAULT_PREMIUM_CONFIG.dropShadow.enabled),
        x: clamp(premiumDropShadow.x, -40, 40, DEFAULT_PREMIUM_CONFIG.dropShadow.x),
        y: clamp(premiumDropShadow.y, -40, 40, DEFAULT_PREMIUM_CONFIG.dropShadow.y),
        blur: clamp(premiumDropShadow.blur, 0, 80, DEFAULT_PREMIUM_CONFIG.dropShadow.blur),
        color: color(premiumDropShadow.color, DEFAULT_PREMIUM_CONFIG.dropShadow.color),
        opacity: clamp(premiumDropShadow.opacity, 0, 100, DEFAULT_PREMIUM_CONFIG.dropShadow.opacity),
      },
      easing: choice(premium.easing, ['easeOutBack', 'easeOut', 'easeInOut', 'linear'] as const, DEFAULT_PREMIUM_CONFIG.easing),
      fontFamily: typeof premium.fontFamily === 'string' ? premium.fontFamily : DEFAULT_PREMIUM_CONFIG.fontFamily,
      fontWeight: {
        support: clamp(premiumFontWeight.support, 100, 900, DEFAULT_PREMIUM_CONFIG.fontWeight.support),
        emphasis: clamp(premiumFontWeight.emphasis, 100, 900, DEFAULT_PREMIUM_CONFIG.fontWeight.emphasis),
      },
      glowColor: color(premium.glowColor, DEFAULT_PREMIUM_CONFIG.glowColor),
      glowBlur: Array.isArray(premium.glowBlur) ? premium.glowBlur.slice(0, 8).map((value: unknown, index: number) => clamp(value, 0, 200, DEFAULT_PREMIUM_CONFIG.glowBlur[index] ?? 0)) : [...DEFAULT_PREMIUM_CONFIG.glowBlur],
      glowIntensity: clamp(premium.glowIntensity, 0, 2, DEFAULT_PREMIUM_CONFIG.glowIntensity),
      highlightMode: choice(premium.highlightMode, ['word', 'line', 'karaoke'] as const, DEFAULT_PREMIUM_CONFIG.highlightMode),
      inDuration: clamp(premium.inDuration, 0, 2000, DEFAULT_PREMIUM_CONFIG.inDuration),
      justify: choice(premium.justify, ['center', 'left'] as const, DEFAULT_PREMIUM_CONFIG.justify),
      karaokeFill: color(premium.karaokeFill, DEFAULT_PREMIUM_CONFIG.karaokeFill),
      lineHeight: clamp(premium.lineHeight, 0.5, 2, DEFAULT_PREMIUM_CONFIG.lineHeight),
      linesPerChunk: clamp(premium.linesPerChunk, 1, 4, DEFAULT_PREMIUM_CONFIG.linesPerChunk),
      maxWidthPercent: clamp(premium.maxWidthPercent, 40, 100, DEFAULT_PREMIUM_CONFIG.maxWidthPercent),
      neonLayers: clamp(premium.neonLayers, 1, 8, DEFAULT_PREMIUM_CONFIG.neonLayers),
      outDuration: clamp(premium.outDuration, 0, 2000, DEFAULT_PREMIUM_CONFIG.outDuration),
      positionY: clamp(premium.positionY, 0, 100, DEFAULT_PREMIUM_CONFIG.positionY),
      quality: clamp(premium.quality, 1, 4, DEFAULT_PREMIUM_CONFIG.quality),
      ratioScale: clamp(premium.ratioScale, 1, 3, DEFAULT_PREMIUM_CONFIG.ratioScale),
      fontSizeBase: clamp(premium.fontSizeBase, 1, 20, DEFAULT_PREMIUM_CONFIG.fontSizeBase),
      strokeWidth: clamp(premium.strokeWidth, 0, 12, DEFAULT_PREMIUM_CONFIG.strokeWidth),
      textColor: color(premium.textColor, DEFAULT_PREMIUM_CONFIG.textColor),
      uppercaseOverride: Array.isArray(premium.uppercaseOverride) ? premium.uppercaseOverride.filter((value: unknown): value is string => typeof value === 'string').slice(0, 64) : [],
      verticalSafeZone: {
        top: clamp(premiumSafeZone.top, 0, 40, DEFAULT_PREMIUM_CONFIG.verticalSafeZone.top),
        bottom: clamp(premiumSafeZone.bottom, 0, 40, DEFAULT_PREMIUM_CONFIG.verticalSafeZone.bottom),
        left: clamp(premiumSafeZone.left, 0, 40, DEFAULT_PREMIUM_CONFIG.verticalSafeZone.left),
        right: clamp(premiumSafeZone.right, 0, 40, DEFAULT_PREMIUM_CONFIG.verticalSafeZone.right),
      },
      wordsPerChunk: {
        min: clamp(premiumWordsPerChunk.min, 1, 4, DEFAULT_PREMIUM_CONFIG.wordsPerChunk.min),
        max: clamp(premiumWordsPerChunk.max, 1, 4, DEFAULT_PREMIUM_CONFIG.wordsPerChunk.max),
      },
      xOffset: clamp(premium.xOffset, -50, 50, DEFAULT_PREMIUM_CONFIG.xOffset),
      yOffset: clamp(premium.yOffset, -50, 50, DEFAULT_PREMIUM_CONFIG.yOffset),
      zIndex: {
        glow: clamp(premiumZIndex.glow, 0, 1000, DEFAULT_PREMIUM_CONFIG.zIndex.glow),
        fill: clamp(premiumZIndex.fill, 0, 1000, DEFAULT_PREMIUM_CONFIG.zIndex.fill),
        support: clamp(premiumZIndex.support, 0, 1000, DEFAULT_PREMIUM_CONFIG.zIndex.support),
      },
      emphasisStrategy: choice(premium.emphasisStrategy, ['last', 'longest', 'custom'] as const, DEFAULT_PREMIUM_CONFIG.emphasisStrategy),
      emphasisWord: typeof premium.emphasisWord === 'string' ? premium.emphasisWord.slice(0, 80) : '',
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
    position: { ...current.position, ...patch.position }, highlight: { ...current.highlight, ...patch.highlight }, wordEmphasis: { ...current.wordEmphasis, ...patch.wordEmphasis },
    premium: { ...current.premium, ...patch.premium, lightSweep: { ...current.premium.lightSweep, ...patch.premium?.lightSweep }, dropShadow: { ...current.premium.dropShadow, ...patch.premium?.dropShadow }, fontWeight: { ...current.premium.fontWeight, ...patch.premium?.fontWeight }, verticalSafeZone: { ...current.premium.verticalSafeZone, ...patch.premium?.verticalSafeZone }, wordsPerChunk: { ...current.premium.wordsPerChunk, ...patch.premium?.wordsPerChunk }, zIndex: { ...current.premium.zIndex, ...patch.premium?.zIndex } },
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
