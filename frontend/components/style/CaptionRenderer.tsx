import { CSSProperties, ReactNode } from 'react';
import { cssFontFamily, fontForText, scaleToFontPixels, strokeToPixels } from '../../lib/captionStyle';
import type { CaptionStyle, WordTimestamp } from '../../lib/captionStyle';

export type CaptionFrame = { width: number; height: number };
type Props = { style: CaptionStyle; text: string; words?: WordTimestamp[]; activeWordIndex?: number; revealedWordIndex?: number; containerSize: CaptionFrame; className?: string };

function rgba(hex: string, opacity: number) {
  const raw = hex.slice(1);
  if (!/^[\da-f]{6}$/i.test(raw)) return `rgba(0,0,0,${opacity / 100})`;
  const channels = [0, 2, 4].map((index) => parseInt(raw.slice(index, index + 2), 16));
  return `rgba(${channels.join(',')},${Math.max(0, Math.min(100, opacity)) / 100})`;
}
const animations: Record<CaptionStyle['animation'], string> = {
  zoomIn: 'captionZoom .24s ease-out both', popIn: 'captionPop .2s ease-out both', fade: 'captionFade .25s ease-out both',
  slideUp: 'captionSlide .25s ease-out both', typewriter: 'captionType .5s steps(12,end) both', none: 'none',
};

export default function CaptionRenderer({ style, text, words, activeWordIndex = -1, revealedWordIndex = activeWordIndex, containerSize, className }: Props) {
  const lines = text.split('\n');
  const tokens = text.split(/\s+/).filter(Boolean);
  const timed = Boolean(words?.length && words.length === tokens.length && words.every((word) => Number.isFinite(word.start) && Number.isFinite(word.end)));
  let index = 0;
  const content: ReactNode[] = lines.map((line, lineIndex) => {
    const lineWords = line.split(/\s+/).filter(Boolean);
    const rendered = lineWords.map((word, wordIndex) => {
      const wordIndexGlobal = index++;
      const visible = !style.reveal.enabled || !timed || revealedWordIndex < 0 || wordIndexGlobal <= revealedWordIndex;
      const highlighted = style.highlight.enabled && timed && wordIndexGlobal === activeWordIndex;
      const family = style.alternateFontFamily && wordIndexGlobal % 2 === 1 ? style.alternateFontFamily : style.fontFamily;
      const wordStyle: CSSProperties = { fontFamily: cssFontFamily(fontForText(family, word)), color: highlighted ? style.highlight.textColor : style.textColor,
        backgroundColor: highlighted ? rgba(style.highlight.boxColor, style.highlight.boxOpacity) : 'transparent',
        borderRadius: highlighted ? `${style.highlight.boxRadius * containerSize.height / 1080}px` : undefined,
        padding: highlighted ? '0 .08em' : undefined };
      return <span key={`${wordIndexGlobal}-${word}`} className={visible ? 'caption-word' : 'invisible'} style={wordStyle}>{word}{wordIndex < lineWords.length - 1 ? ' ' : ''}</span>;
    });
    return <span key={`line-${lineIndex}`}>{lineIndex > 0 && <br />}{rendered}</span>;
  });
  const baseStyle: CSSProperties & { WebkitTextStroke?: string } = {
    fontFamily: cssFontFamily(style.fontFamily), fontSize: `${scaleToFontPixels(style.scale, containerSize.height)}px`,
    fontWeight: style.bold ? 800 : 500, fontStyle: style.italic ? 'italic' : 'normal', color: style.textColor,
    WebkitTextStroke: style.stroke.enabled ? `${strokeToPixels(style.stroke.widthPx, containerSize.height)}px ${style.stroke.color}` : '0 transparent',
    backgroundColor: style.background.enabled ? rgba(style.background.color, style.background.opacity) : 'transparent',
    padding: style.background.enabled ? `${style.background.paddingPx * containerSize.height / 1080}px` : 0,
    borderRadius: style.background.enabled ? `${style.background.radius * containerSize.height / 1080}px` : 0,
    animation: animations[style.animation], whiteSpace: 'pre-wrap', lineHeight: 1.35,
  };
  return <div className={className} style={{ ...baseStyle, maxWidth: '92%', textAlign: 'center', overflowWrap: 'anywhere' }}>{content}</div>;
}
