import { CSSProperties } from 'react';
import { cssFontFamily, scaleToFontPixels, strokeToPixels } from '../../lib/captionStyle';
import type { CaptionStyle, WordTimestamp } from '../../lib/captionStyle';
import { breakCaptionLines } from '../../lib/captionLines';
import { useVideoStore } from '../../store/videoStore';

export type CaptionFrame = { width: number; height: number };
type Props = { style: CaptionStyle; text: string; words?: WordTimestamp[]; activeWordIndex?: number; revealedWordIndex?: number; containerSize: CaptionFrame; className?: string };

function rgba(hex: string, opacity: number) {
  const raw = hex.slice(1);
  if (!/^[\da-f]{6}$/i.test(raw)) return `rgba(0,0,0,${opacity / 100})`;
  const channels = [0, 2, 4].map((index) => parseInt(raw.slice(index, index + 2), 16));
  return `rgba(${channels.join(',')},${Math.max(0, Math.min(100, opacity)) / 100})`;
}
export default function CaptionRenderer({ style, text, words, activeWordIndex = -1, revealedWordIndex = activeWordIndex, containerSize, className }: Props) {
  const maxWordsPerLine = useVideoStore((state) => state.maxWordsPerLine);
  const maxLinesPerSubtitle = useVideoStore((state) => state.maxLinesPerSubtitle);
  const tokens = (words?.length ? words.map((word) => word.text) : text.split(/\s+/)).filter(Boolean);
  const timed = Boolean(words?.length && words.length === tokens.length && words.every((word) => Number.isFinite(word.start) && Number.isFinite(word.end)));
  const fontSize = scaleToFontPixels(style.scale, containerSize.height);
  const lineWords = breakCaptionLines(tokens, containerSize.width * 0.85 / fontSize, maxWordsPerLine, maxLinesPerSubtitle);
  let wordIndexGlobal = 0;
  const animationName: Record<CaptionStyle['animation'], string> = { zoomIn: 'captionZoom', popIn: 'captionPop', fade: 'captionFade', slideUp: 'captionSlide', typewriter: 'captionType', none: '' };
  const content = lineWords.map((line, lineIndex) => {
    const rendered = line.map((word) => {
      const wordIndex = wordIndexGlobal++;
      const visible = !style.reveal.enabled || !timed || revealedWordIndex < 0 || wordIndex <= revealedWordIndex;
      const highlighted = style.highlight.enabled && timed && wordIndex === activeWordIndex;
      const animation = animationName[style.animation];
      const wordStyle: CSSProperties = {
        color: highlighted ? style.highlight.textColor : style.textColor,
        backgroundColor: highlighted ? rgba(style.highlight.boxColor, style.highlight.boxOpacity) : 'transparent',
        borderRadius: `${style.highlight.boxRadius * containerSize.height / 1080}px`,
        lineHeight: '1.2em', padding: '0.06em 0.08em', verticalAlign: 'baseline',
        transformOrigin: 'center center', animation: animation ? `${animation} .24s ease-out both` : 'none',
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
