import { CSSProperties, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cssFontFamily, fontForText, scaleToFontPixels, strokeToPixels } from '../../lib/captionStyle';
import type { CaptionStyle, PremiumCaptionConfig, WordTimestamp } from '../../lib/captionStyle';
import { breakCaptionLines } from '../../lib/captionLines';
import { chunkPremiumWords, paddedGlyphWidth, selectPremiumChunk, transformPremiumWord } from '../../lib/premiumCaptions';
import { useVideoStore } from '../../store/videoStore';

export type CaptionFrame = { width: number; height: number };
type Props = { style: CaptionStyle; text: string; words?: WordTimestamp[]; activeWordIndex?: number; revealedWordIndex?: number; containerSize: CaptionFrame; className?: string };

function rgba(hex: string, opacity: number) {
  const raw = hex.slice(1);
  if (!/^[\da-f]{6}$/i.test(raw)) return `rgba(0,0,0,${opacity / 100})`;
  const channels = [0, 2, 4].map((index) => parseInt(raw.slice(index, index + 2), 16));
  return `rgba(${channels.join(',')},${Math.max(0, Math.min(100, opacity)) / 100})`;
}

/** Builds every Premium word effect from one alphabetic-baseline glyph mask. */
function renderWordLayer(word: string, font: string, fill: string, size: number, weight: number, width: number, height: number, scale: number, glow: { color: string; opacity: number; radius: number; frameHeight: number }, sweep: { enabled: boolean; position: number; intensity: number; width: number; angle: number; topEdge: boolean }) {
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `${weight} ${size}px ${font}`;
  const metrics = measure.measureText(word);
  const padX = size * .5 + glow.radius * 2;
  const padY = size * .4 + glow.radius * 2;
  const wordWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
  const wordHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((wordWidth + padX * 2) * scale);
  canvas.height = Math.ceil((wordHeight + padY * 2) * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const x = padX + metrics.actualBoundingBoxLeft;
  const y = padY + metrics.actualBoundingBoxAscent;
  const glyph = document.createElement('canvas'); glyph.width = canvas.width; glyph.height = canvas.height;
  const g = glyph.getContext('2d')!; g.setTransform(scale, 0, 0, scale, 0, 0); g.font = measure.font; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'; g.fillText(word, x, y);
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = canvas.width; glowCanvas.height = canvas.height;
  const gc = glowCanvas.getContext('2d')!; gc.setTransform(scale, 0, 0, scale, 0, 0); gc.globalCompositeOperation = 'screen';
  for (const [ratio, alpha] of [[.012,.55],[.03,.35],[.065,.22]] as const) {
    gc.save(); gc.globalAlpha = Math.min(.6, glow.opacity) * alpha; gc.shadowColor = glow.color; gc.shadowBlur = glow.frameHeight * ratio * glow.radius;
    gc.shadowOffsetX = 5000; gc.drawImage(glyph, -5000, 0, canvas.width / scale, canvas.height / scale); gc.restore();
  }
  ctx.globalCompositeOperation = 'screen'; ctx.drawImage(glowCanvas, 0, 0, canvas.width / scale, canvas.height / scale); ctx.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = fill.split('|')[0]; ctx.font = measure.font; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(word, x, y); ctx.restore();
  // A narrow, feathered inner rim keeps the purple fill dominant.
  const edgeMask = document.createElement('canvas'); edgeMask.width = canvas.width; edgeMask.height = canvas.height;
  const edge = edgeMask.getContext('2d')!; edge.setTransform(scale, 0, 0, scale, 0, 0); edge.drawImage(glyph, 0, 0, canvas.width / scale, canvas.height / scale);
  edge.globalCompositeOperation = 'destination-out'; edge.shadowColor = '#000'; edge.shadowBlur = size * .04; edge.drawImage(glyph, 0, 0, canvas.width / scale, canvas.height / scale); edge.shadowBlur = 0;
  edge.globalCompositeOperation = 'source-in';
  const edgeTint = edge.createLinearGradient(padX + wordWidth, padY, padX, padY + wordHeight);
  edgeTint.addColorStop(0, 'rgba(111,184,255,.9)'); edgeTint.addColorStop(.55, 'rgba(111,184,255,.45)'); edgeTint.addColorStop(1, 'rgba(111,184,255,.08)');
  edge.fillStyle = edgeTint; edge.fillRect(0, 0, canvas.width / scale, canvas.height / scale);
  ctx.globalCompositeOperation = 'screen'; ctx.drawImage(edgeMask, 0, 0, canvas.width / scale, canvas.height / scale); ctx.globalCompositeOperation = 'source-over';
  if (sweep.enabled) {
    const sheen = document.createElement('canvas'); sheen.width = canvas.width; sheen.height = canvas.height; const sc = sheen.getContext('2d')!; sc.setTransform(scale,0,0,scale,0,0);
    const band = wordWidth * sweep.width / 100, center = padX + wordWidth * sweep.position / 100, radians = sweep.angle * Math.PI / 180;
    const grad = sc.createLinearGradient(center - Math.sin(radians)*band/2, 0, center + Math.sin(radians)*band/2, 0);
    const a = Math.min(.5, sweep.intensity * .5); grad.addColorStop(0,'rgba(255,255,255,0)'); grad.addColorStop(.5,`rgba(255,255,255,${a})`); grad.addColorStop(1,'rgba(255,255,255,0)'); sc.fillStyle=grad; sc.fillRect(0,0,canvas.width/scale,canvas.height/scale); sc.globalCompositeOperation='destination-in'; sc.drawImage(glyph,0,0,canvas.width/scale,canvas.height/scale); ctx.globalCompositeOperation='screen'; ctx.drawImage(sheen,0,0,canvas.width/scale,canvas.height/scale); ctx.globalCompositeOperation='source-over';
  }
  if (sweep.topEdge) { const rim=document.createElement('canvas'); rim.width=canvas.width; rim.height=canvas.height; const rc=rim.getContext('2d')!; rc.setTransform(scale,0,0,scale,0,0); rc.drawImage(glyph,0,0,canvas.width/scale,canvas.height/scale); rc.globalCompositeOperation='destination-out'; rc.drawImage(glyph,0,2,canvas.width/scale,canvas.height/scale); rc.globalCompositeOperation='source-in'; rc.fillStyle='rgba(255,255,255,.6)'; rc.fillRect(0,0,canvas.width/scale,canvas.height/scale); ctx.drawImage(rim,0,0,canvas.width/scale,canvas.height/scale); }
  return { canvas, padX, padY, ascent: metrics.actualBoundingBoxAscent, width: wordWidth, height: wordHeight };
}

function drawPremiumBigWord(ctx: CanvasRenderingContext2D, word: string, x: number, y: number, settings: Parameters<typeof renderWordLayer>[1] extends never ? never : { font: string; fill: string; size: number; weight: number; width: number; height: number; scale: number; glow: { color: string; opacity: number; radius: number; frameHeight: number }; sweep: { enabled: boolean; position: number; intensity: number; width: number; angle: number; topEdge: boolean } }) {
  const layer = renderWordLayer(word, settings.font, settings.fill, settings.size, settings.weight, settings.width, settings.height, settings.scale, settings.glow, settings.sweep);
  ctx.drawImage(layer.canvas, x - layer.padX, y - layer.padY - layer.ascent, layer.canvas.width / settings.scale, layer.canvas.height / settings.scale);
}

function PremiumBigWordCanvas({ word, font, fill, size, weight, frame, glow, sweep, quality }: { word: string; font: string; fill: string; size: number; weight: number; frame: CaptionFrame; glow: { color: string; opacity: number; radius: number }; sweep: { enabled: boolean; position: number; intensity: number; width: number; angle: number; topEdge: boolean }; quality: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const scale = Math.max(1, Math.min(4, quality * (window.devicePixelRatio || 1)));
    const measure = document.createElement('canvas').getContext('2d')!; measure.font = `${weight} ${size}px ${font}`;
    const m = measure.measureText(word); const padX = size * .5 + frame.height * .07 * glow.radius * 2; const padY = size * .4 + frame.height * .07 * glow.radius * 2;
    canvas.width = Math.ceil((m.actualBoundingBoxLeft + m.actualBoundingBoxRight + padX * 2) * scale); canvas.height = Math.ceil((m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + padY * 2) * scale);
    canvas.style.width = `${canvas.width / scale}px`;
    canvas.style.height = `${canvas.height / scale}px`;
    const out = canvas.getContext('2d'); if (!out) return; out.setTransform(scale, 0, 0, scale, 0, 0);
    drawPremiumBigWord(out, word, padX, padY + m.actualBoundingBoxAscent, { font, fill, size, weight, width: frame.width, height: frame.height, scale, glow: { ...glow, frameHeight: frame.height }, sweep });
  }, [word, font, fill, size, weight, frame.width, frame.height, glow.color, glow.opacity, glow.radius, sweep.enabled, sweep.position, sweep.intensity, sweep.width, sweep.angle, sweep.topEdge, quality]);
  return <canvas ref={ref} aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 3 }} />;
}

function PremiumCaptionBlock({ style, text, words, activeWordIndex, revealedWordIndex, containerSize, className }: Props) {
  const config = style.premium;
  const [fontsReady, setFontsReady] = useState(false);
  const measurementCanvas = useRef<HTMLCanvasElement | null>(null);
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    let current = true;
    void document.fonts?.ready.then(() => { if (current) setFontsReady(true); });
    return () => { current = false; };
  }, [config.fontFamily]);
  if (typeof document !== 'undefined' && !measurementCanvas.current) measurementCanvas.current = document.createElement('canvas');
  const tokens = (words?.length ? words.map((word) => word.text) : text.split(/\s+/)).filter(Boolean);
  const tokenKey = tokens.join('\u0000');
  const supportSize = containerSize.height * config.fontSizeBase / 100;
  const maxWidth = containerSize.width * Math.min(88, config.maxWidthPercent) / 100;
  const measureContext = measurementCanvas.current?.getContext('2d') || null;
  const measureText = (value: string, size: number, weight: number) => {
    if (!measureContext) return value.length * size * .55;
    const family = fontForText(config.fontFamily, value);
    measureContext.font = `${weight} ${size}px ${cssFontFamily(family)}`;
    const letterSpace = Math.max(0, value.length - 1) * size * -.02;
    const metrics = measureContext.measureText(value);
    return paddedGlyphWidth(metrics, value, size);
  };
  const chunks = useMemo(() => chunkPremiumWords(tokenKey ? tokenKey.split('\u0000') : [], config, maxWidth, supportSize, measureText), [tokenKey, config, maxWidth, supportSize, fontsReady]);
  const chunk = selectPremiumChunk(chunks, activeWordIndex);
  const chunkOffset = chunk.wordOffset;
  const chunkTokens = chunk.words;
  const emphasisIndex = chunk.emphasisIndex;
  const emphasisGlobalIndex = chunkOffset + emphasisIndex;
  const emphasisWord = chunkTokens[emphasisIndex] || '';
  const emphasisText = transformPremiumWord(emphasisWord, config);
  const supportingWords = chunkTokens.map((word, index) => ({ word, index })).filter((item) => item.index !== emphasisIndex);
  const supportingText = supportingWords.map(({ word }) => transformPremiumWord(word, config)).join(' ');
  const frameRatio = Math.max(1, containerSize.height) / 1080;
  const blockScale = Math.max(.55, Math.min(chunk.supportScale, chunk.emphasisScale));
  const renderedSupportSize = supportSize * blockScale;
  const emphasisSize = supportSize * config.ratioScale;
  const actualEmphasisSize = emphasisSize * blockScale;

  const isVisible = (globalIndex: number) => !style.reveal.enabled || globalIndex <= revealedWordIndex;
  const shadow = config.dropShadow.enabled ? `${config.dropShadow.x * frameRatio}px ${config.dropShadow.y * frameRatio}px ${config.dropShadow.blur * frameRatio}px ${rgba(config.dropShadow.color, config.dropShadow.opacity)}` : 'none';
  const emphasisTiming = words?.[emphasisGlobalIndex];
  const pulseDuration = Math.max(.12, (emphasisTiming?.end ?? 0) - (emphasisTiming?.start ?? 0));
  const easing = config.easing === 'easeOutBack' ? 'cubic-bezier(.34,1.56,.64,1)' : config.easing === 'easeOut' ? 'ease-out' : config.easing === 'easeInOut' ? 'ease-in-out' : 'linear';
  const boxStyle = config.backgroundBox === 'none' ? {} : {
    backgroundColor: 'rgba(0,0,0,.34)', borderRadius: config.backgroundBox === 'pill' ? '9999px' : `${12 * frameRatio}px`,
    padding: `${8 * frameRatio}px ${18 * frameRatio}px`,
  };
  const gradient = config.gradientEnabled ? `linear-gradient(90deg, ${config.accentGradient[0]}, ${config.accentGradient[1]})` : `linear-gradient(90deg, ${config.accentColor}, ${config.accentColor})`;
  const line2Style: CSSProperties = {
    position: 'relative', zIndex: config.zIndex.fill, display: 'block', width: 'max-content', maxWidth: 'none', boxSizing: 'content-box', padding: 0, whiteSpace: 'nowrap', wordBreak: 'normal', overflowWrap: 'normal', overflow: 'visible', isolation: 'isolate',
    fontFamily: `${cssFontFamily(fontForText(config.fontFamily, emphasisText))}, "Noto Sans Telugu", "Noto Sans Devanagari", "Noto Sans Tamil", sans-serif`,
    fontSize: `${actualEmphasisSize}px`, fontWeight: config.fontWeight.emphasis, lineHeight: config.lineHeight,
    letterSpacing: '-0.02em', textAlign: 'center', color: 'transparent',
    backgroundImage: 'none', WebkitTextFillColor: 'transparent',
  };

  return <div key={`${words?.[0]?.start ?? 0}-${chunkOffset}`} className={`premium-caption-block ${className || ''}`} style={{ ...boxStyle, position: 'relative', display: 'flex', width: '100%', maxWidth: `${Math.min(88, config.maxWidthPercent)}%`, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: `${renderedSupportSize * (config.lineGap ?? .1)}px`, whiteSpace: 'nowrap', overflow: 'visible', textAlign: 'center', lineHeight: config.lineHeight, transformOrigin: 'center center', animation: `premiumCaptionEnter ${config.inDuration}ms ${easing} both`, textRendering: config.quality > 1 ? 'geometricPrecision' : 'auto', WebkitFontSmoothing: 'antialiased' }}>
    {supportingWords.length > 0 && <div className="premium-caption-support" style={{ position: 'relative', zIndex: config.zIndex.support, width: 'max-content', maxWidth: 'none', boxSizing: 'content-box', padding: 0, fontFamily: `${cssFontFamily(fontForText(config.fontFamily, supportingText))}, "Noto Sans Telugu", "Noto Sans Devanagari", "Noto Sans Tamil", sans-serif`, fontSize: `${renderedSupportSize}px`, fontWeight: config.fontWeight.support, color: config.textColor, lineHeight: config.lineHeight, letterSpacing: '-0.02em', textAlign: 'center', textShadow: shadow, textTransform: 'none', whiteSpace: 'nowrap', wordBreak: 'normal', overflowWrap: 'normal', overflow: 'visible' }}>
      {supportingWords.map(({ word, index }) => {
        const globalIndex = chunkOffset + index;
        const tokenText = transformPremiumWord(word, config);
        const karaokeActive = config.highlightMode === 'karaoke' && activeWordIndex >= globalIndex;
          return <span key={`${globalIndex}-${word}`} className={isVisible(globalIndex) ? '' : 'invisible'} style={{ color: karaokeActive ? config.karaokeFill : config.textColor, display: 'inline-block', whiteSpace: 'nowrap', wordBreak: 'normal', overflowWrap: 'normal', marginRight: index === supportingWords.length - 1 ? 0 : '.22em' }}>{tokenText}</span>;
      })}
    </div>}
    {emphasisWord && isVisible(emphasisGlobalIndex) && <div className="premium-caption-emphasis" style={{ position: 'relative', width: 'max-content', maxWidth: 'none', whiteSpace: 'nowrap', wordBreak: 'normal', overflowWrap: 'normal', overflow: 'visible', isolation: 'isolate' }}>
      <span style={line2Style}>{emphasisText}<PremiumBigWordCanvas word={emphasisText} font={`${cssFontFamily(fontForText(config.fontFamily, emphasisText))}, "Noto Sans Telugu", "Noto Sans Devanagari", "Noto Sans Tamil", sans-serif`} fill={config.accentGradient.join('|')} size={actualEmphasisSize} weight={config.fontWeight.emphasis} frame={containerSize} glow={{ color: config.glowColor, opacity: config.glowExposure, radius: config.glowRadius }} sweep={{ enabled: config.lightSweep.enabled, position: config.lightSweep.position, intensity: config.lightSweep.intensity, width: config.lightSweep.width, angle: config.lightSweep.angle, topEdge: config.lightSweep.topEdge }} quality={config.quality} /></span>
    </div>}
    {void fontsReady}
  </div>;
}

export default function CaptionRenderer({ style, text, words, activeWordIndex = -1, revealedWordIndex = activeWordIndex, containerSize, className }: Props) {
  const maxWordsPerLine = useVideoStore((state) => state.maxWordsPerLine);
  const maxLinesPerSubtitle = useVideoStore((state) => state.maxLinesPerSubtitle);
  const tokens = (words?.length ? words.map((word) => word.text) : text.split(/\s+/)).filter(Boolean);
  const timed = Boolean(words?.length && words.length === tokens.length && words.every((word) => Number.isFinite(word.start) && Number.isFinite(word.end)));
  if (style.premium.enabled) {
    return <PremiumCaptionBlock key={`${words?.[0]?.start ?? 0}`} style={style} text={text} words={timed ? words : undefined} activeWordIndex={activeWordIndex} revealedWordIndex={revealedWordIndex} containerSize={containerSize} className={className} />;
  }
  const fontSize = scaleToFontPixels(style.scale, containerSize.height);
  const lineWords = breakCaptionLines(tokens, containerSize.width * 0.85 / fontSize, maxWordsPerLine, maxLinesPerSubtitle);
  let wordIndexGlobal = 0;
  const animationName: Record<CaptionStyle['animation'], string> = { zoomIn: 'captionZoom', popIn: 'captionPop', fade: 'captionFade', slideUp: 'captionSlide', typewriter: 'captionType', none: '' };
  const content = lineWords.map((line, lineIndex) => {
    const rendered = line.map((word) => {
      const wordIndex = wordIndexGlobal++;
      const visible = !style.reveal.enabled || !timed || revealedWordIndex < 0 || wordIndex <= revealedWordIndex;
      const highlighted = style.highlight.enabled && timed && wordIndex === activeWordIndex;
      // The Devin Jatho look gives one keyword the treatment for the whole cue.
      // Use the final spoken token as the emphasis target rather than cycling
      // the purple effect across every timestamped word.
      const emphasized = style.wordEmphasis.enabled && wordIndex === tokens.length - 1;
      const animation = animationName[style.animation];
      const emphasisScale = style.wordEmphasis.scale;
      const glowBlur = style.wordEmphasis.glowBlurPx * containerSize.height / 1080;
      const emphasisStroke = style.wordEmphasis.strokeWidthPx * containerSize.height / 1080;
      const deepGlow = `0 0 ${glowBlur * 0.18}px ${style.wordEmphasis.strokeColor}, 0 0 ${glowBlur * 0.5}px ${style.wordEmphasis.glowColor}, 0 0 ${glowBlur}px ${rgba(style.wordEmphasis.glowColor, 96)}, 0 0 ${glowBlur * 1.7}px ${rgba(style.wordEmphasis.glowColor, 78)}, 0 0 ${glowBlur * 2.8}px ${rgba(style.wordEmphasis.glowColor, 52)}`;
      const wordStyle: CSSProperties & { '--caption-word-scale'?: string; '--caption-word-blur'?: string; '--caption-glow-end'?: string } = {
        color: emphasized ? style.wordEmphasis.textColor : style.wordEmphasis.enabled ? style.textColor : highlighted ? style.highlight.textColor : style.textColor,
        backgroundColor: highlighted && !style.wordEmphasis.enabled ? rgba(style.highlight.boxColor, style.highlight.boxOpacity) : 'transparent',
        borderRadius: `${style.highlight.boxRadius * containerSize.height / 1080}px`,
        lineHeight: '1.2em', padding: '0.06em 0.08em', verticalAlign: 'baseline',
        fontWeight: style.wordEmphasis.enabled ? (emphasized ? 800 : 500) : undefined,
        letterSpacing: style.wordEmphasis.enabled ? (emphasized ? `${style.wordEmphasis.letterSpacingEm}em` : '-0.025em') : undefined,
        transform: emphasized ? `scale(${emphasisScale})` : undefined,
        textShadow: emphasized && glowBlur > 0 ? deepGlow : undefined,
        '--caption-word-scale': String(emphasisScale),
        '--caption-word-blur': `${Math.max(4, containerSize.height * 0.012)}px`,
        '--caption-glow-end': deepGlow,
        WebkitTextStroke: emphasized && emphasisStroke > 0 ? `${emphasisStroke}px ${style.wordEmphasis.strokeColor}` : undefined,
        transformOrigin: 'center center', animation: emphasized ? 'captionWordRiseGlow .52s cubic-bezier(.2,.75,.25,1) both' : animation ? `${animation} .24s ease-out both` : 'none',
      };
      return <span key={`${wordIndex}-${word}`} className={`caption-word ${visible ? '' : 'invisible'}`} style={wordStyle}>{word}</span>;
    });
    return <div key={`line-${lineIndex}`} className="caption-line" style={{ fontFamily: `${cssFontFamily(style.fontFamily)}, "Noto Sans Telugu", "Noto Sans Devanagari", "Noto Sans Tamil", sans-serif`, lineHeight: '1.2em' }}>{rendered}</div>;
  });
  const baseStyle: CSSProperties & { WebkitTextStroke?: string } = {
    fontFamily: cssFontFamily(style.fontFamily), fontSize: `${fontSize}px`,
    fontWeight: style.bold ? 800 : 500, fontStyle: style.italic ? 'italic' : 'normal', color: style.textColor,
    WebkitTextStroke: style.stroke.enabled ? `${strokeToPixels(style.stroke.widthPx, containerSize.height)}px ${style.stroke.color}` : '0 transparent',
    backgroundColor: style.background.enabled ? rgba(style.background.color, style.background.opacity) : 'transparent',
    padding: style.background.enabled ? `${style.background.paddingPx * containerSize.height / 1080}px` : 0,
    borderRadius: style.background.enabled ? `${style.background.radius * containerSize.height / 1080}px` : 0,
    whiteSpace: 'nowrap', lineHeight: '1.2em',
  };
  return <div className={className} style={{ ...baseStyle, width: '85%', maxWidth: '85%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'visible' }}>{content}</div>;
}
