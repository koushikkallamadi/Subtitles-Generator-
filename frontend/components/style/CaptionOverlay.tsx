import { PointerEvent as ReactPointerEvent, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { CaptionStyle, Cue, useVideoStore } from '../../store/videoStore';

type Bounds = { left: number; top: number; width: number; height: number };
function frameBounds(video: HTMLVideoElement | null): Bounds | null {
  const parent = video?.parentElement;
  if (!video || !parent || !video.videoWidth || !video.videoHeight) return null;
  const outer = parent.getBoundingClientRect(), ratio = video.videoWidth / video.videoHeight;
  const width = Math.min(outer.width, outer.height * ratio), height = width / ratio;
  return { left: (outer.width - width) / 2, top: (outer.height - height) / 2, width, height };
}
function rgba(hex: string, opacity: number) {
  const value = hex.replace('#', '');
  if (value.length !== 6) return `rgba(17,17,17,${opacity / 100})`;
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  return `rgba(${channels[0]},${channels[1]},${channels[2]},${Math.max(0, Math.min(100, opacity)) / 100})`;
}
const animationCss: Record<string, string> = {
  'Zoom in': 'captionZoom .24s ease-out both', 'Pop in': 'captionPop .2s ease-out both', Fade: 'captionFade .25s ease-out both',
  'Slide up': 'captionSlide .25s ease-out both', Typewriter: 'captionType .5s steps(12,end) both', None: 'none',
};

export default function CaptionOverlay({ cue, currentTime, videoRef }: { cue?: Cue; currentTime: number; videoRef: RefObject<HTMLVideoElement> }) {
  const style = useVideoStore((state) => state.captionStyle);
  const timingOffset = useVideoStore((state) => state.timingOffset);
  const setStyle = useVideoStore((state) => state.setCaptionStyle);
  const [, setFrameRevision] = useState(0);
  const pointer = useRef<{ x: number; y: number; startX: number; startY: number; size: number; mode: 'drag' | 'resize' } | null>(null);
  const bounds = frameBounds(videoRef.current);
  useEffect(() => {
    const parent = videoRef.current?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setFrameRevision((revision) => revision + 1));
    observer.observe(parent);
    return () => observer.disconnect();
  }, [videoRef]);
  const content = useMemo(() => {
    if (!cue) return null;
    const tokens = cue.text.split(/\s+/).filter(Boolean);
    const timedWords = cue.words?.length === tokens.length && cue.words.every((word) => Number.isFinite(word.start) && Number.isFinite(word.end));
    if (!timedWords) return <span>{cue.text.split('\n').map((line, index) => <span key={index}>{index > 0 && <br />}{line}</span>)}</span>;
    let tokenIndex = 0;
    return <span>{cue.text.split('\n').map((line, lineIndex) => <span key={lineIndex}>{lineIndex > 0 && <br />}{line.split(/\s+/).filter(Boolean).map((word, wordIndex) => {
      const index = tokenIndex++, timestamp = cue.words![index], visible = !style.reveal || currentTime >= timestamp.start + timingOffset;
      const highlighted = style.wordHighlight && currentTime >= timestamp.start + timingOffset && currentTime <= timestamp.end + timingOffset;
      const mixedFont = style.preset === 'Duo' ? { fontFamily: index % 2 ? 'Caveat, cursive' : '"Bebas Neue", sans-serif' } : undefined;
      return <span key={`${index}-${wordIndex}`} style={{ ...mixedFont, ...(highlighted ? { color: style.highlightTextColor, backgroundColor: rgba(style.highlightBoxColor, style.highlightOpacity), borderRadius: 3, padding: '0 .08em' } : {}) }} className={visible ? 'caption-word' : 'invisible'}>{word}{wordIndex < line.split(/\s+/).filter(Boolean).length - 1 ? ' ' : ''}</span>;
    })}</span>)}</span>;
  }, [cue, currentTime, timingOffset, style.preset, style.reveal, style.wordHighlight, style.highlightTextColor, style.highlightBoxColor, style.highlightOpacity]);
  if (!cue || !bounds || !content) return null;

  const begin = (event: ReactPointerEvent<HTMLElement>, mode: 'drag' | 'resize') => {
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { x: event.clientX, y: event.clientY, startX: style.x, startY: style.y, size: style.size, mode };
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    if (!pointer.current) return;
    const start = pointer.current;
    if (start.mode === 'drag') {
      const halfWidth = event.currentTarget.offsetWidth / 2 / bounds.width * 100;
      const height = event.currentTarget.offsetHeight / bounds.height * 100;
      const x = Math.max(halfWidth, Math.min(100 - halfWidth, start.startX + (event.clientX - start.x) / bounds.width * 100));
      const y = Math.max(height, Math.min(100, start.startY + (event.clientY - start.y) / bounds.height * 100));
      setStyle({ x: Math.round(x), y: Math.round(y) });
    } else {
      setStyle({ size: Math.max(30, Math.min(250, Math.round(start.size + (event.clientX - start.x + event.clientY - start.y) * 0.35))) });
    }
  };
  const end = (event: ReactPointerEvent<HTMLElement>) => { pointer.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  const fontFamily = style.font === 'System' ? 'system-ui, sans-serif' : `"${style.font}", sans-serif`;
  const textStyle: React.CSSProperties & { WebkitTextStroke?: string } = {
    fontFamily, fontSize: `${18 * style.size / 100}px`, fontWeight: style.bold ? 800 : 500, fontStyle: style.italic ? 'italic' : 'normal',
    color: style.textColor, WebkitTextStroke: style.stroke ? `${style.strokeWidth}px ${style.strokeColor}` : '0 transparent',
    backgroundColor: style.background ? rgba(style.backgroundColor, style.backgroundOpacity) : 'transparent',
    padding: style.background ? `${style.backgroundPadding}px` : '0', borderRadius: style.background ? `${style.backgroundRadius}px` : '0',
    animation: animationCss[style.animation] || 'none', whiteSpace: 'pre-wrap', lineHeight: 1.35,
  };
  return <div key={`${cue.start}-${style.animation}`} className="absolute z-10" style={{ left: bounds.left + bounds.width * style.x / 100, top: bounds.top + bounds.height * style.y / 100, transform: 'translate(-50%, -100%)' }}>
    <div onPointerDown={(event) => begin(event, 'drag')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} className="relative cursor-move touch-none select-none rounded-md px-1 py-0.5 text-center shadow-lg" style={{ ...textStyle, maxWidth: `${bounds.width * 0.92}px` }}>
      {content}
      <button type="button" aria-label="Resize captions" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => begin(event, 'resize')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} className="absolute -bottom-2 -right-2 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-white bg-[#dc735c] shadow" />
    </div>
  </div>;
}
