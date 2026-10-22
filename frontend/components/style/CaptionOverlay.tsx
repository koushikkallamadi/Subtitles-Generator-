import { PointerEvent as ReactPointerEvent, RefObject, useEffect, useRef, useState } from 'react';
import { useVideoStore } from '../../store/videoStore';
import type { Cue } from '../../store/videoStore';
import { positionToPixels } from '../../lib/captionStyle';
import CaptionRenderer from './CaptionRenderer';

type Bounds = { left: number; top: number; width: number; height: number };
function frameBounds(video: HTMLVideoElement | null): Bounds | null {
  const parent = video?.parentElement;
  if (!video || !parent || !video.videoWidth || !video.videoHeight) return null;
  const outer = parent.getBoundingClientRect(), ratio = video.videoWidth / video.videoHeight;
  const width = Math.min(outer.width, outer.height * ratio), height = width / ratio;
  return { left: (outer.width - width) / 2, top: (outer.height - height) / 2, width, height };
}

export default function CaptionOverlay({ cue, currentTime, videoRef }: { cue?: Cue; currentTime: number; videoRef: RefObject<HTMLVideoElement> }) {
  const style = useVideoStore((state) => state.captionStyle);
  const timingOffset = useVideoStore((state) => state.timingOffset);
  const setStyle = useVideoStore((state) => state.setCaptionStyle);
  const [, setFrameRevision] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number; startX: number; startY: number; scale: number; mode: 'drag' | 'resize' } | null>(null);
  const bounds = frameBounds(videoRef.current);
  useEffect(() => {
    const parent = videoRef.current?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setFrameRevision((revision) => revision + 1));
    observer.observe(parent);
    return () => observer.disconnect();
  }, [videoRef]);
  useEffect(() => {
    if (!cue || !bounds || !containerRef.current) return;
    const box = containerRef.current.getBoundingClientRect();
    const halfWidth = box.width / 2 / bounds.width * 100;
    const boxHeight = box.height / bounds.height * 100;
    const x = Math.max(halfWidth, Math.min(100 - halfWidth, style.position.x));
    const y = Math.max(boxHeight, Math.min(100, style.position.y));
    if (Math.abs(x - style.position.x) > .01 || Math.abs(y - style.position.y) > .01) setStyle({ position: { x, y } });
  }, [cue, bounds?.width, bounds?.height, style.position.x, style.position.y, style.scale, setStyle]);
  if (!cue || !bounds) return null;
  const timedWords = cue.words?.length === cue.text.split(/\s+/).filter(Boolean).length;
  const adjustedTime = currentTime - timingOffset;
  const activeWordIndex = timedWords ? cue.words!.findIndex((word) => adjustedTime >= word.start && adjustedTime <= word.end) : -1;
  const revealedWordIndex = timedWords ? cue.words!.reduce((latest, word, index) => word.start <= adjustedTime ? index : latest, -1) : -1;
  const position = positionToPixels(style.position, bounds);
  const begin = (event: ReactPointerEvent<HTMLElement>, mode: 'drag' | 'resize') => {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { x: event.clientX, y: event.clientY, startX: style.position.x, startY: style.position.y, scale: style.scale, mode };
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const start = pointer.current;
    if (!start || !bounds) return;
    if (start.mode === 'drag') {
      const box = containerRef.current?.getBoundingClientRect();
      const halfWidth = (box?.width || 0) / 2 / bounds.width * 100;
      const boxHeight = (box?.height || 0) / bounds.height * 100;
      const x = Math.max(halfWidth, Math.min(100 - halfWidth, start.startX + (event.clientX - start.x) / bounds.width * 100));
      const y = Math.max(boxHeight, Math.min(100, start.startY + (event.clientY - start.y) / bounds.height * 100));
      setStyle({ position: { x, y } });
    } else {
      setStyle({ scale: Math.max(40, Math.min(250, Math.round(start.scale + (event.clientX - start.x + event.clientY - start.y) * 0.35))) });
    }
  };
  const end = (event: ReactPointerEvent<HTMLElement>) => { pointer.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  return <div key={`${cue.start}-${style.animation}`} className="absolute z-10" style={{ left: bounds.left + position.x, top: bounds.top + position.y, transform: 'translate(-50%, -100%)', width: bounds.width * .92, display: 'flex', justifyContent: 'center' }}>
    <div ref={containerRef} onPointerDown={(event) => begin(event, 'drag')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} className="relative flex max-w-full cursor-move touch-none select-none justify-center rounded-md px-1 py-0.5 text-center shadow-lg">
      <CaptionRenderer style={style} text={cue.text} words={timedWords ? cue.words : undefined} activeWordIndex={activeWordIndex} revealedWordIndex={revealedWordIndex} containerSize={{ width: bounds.width, height: bounds.height }} />
      <button type="button" aria-label="Resize captions" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => begin(event, 'resize')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} className="absolute -bottom-2 -right-2 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-white bg-[#dc735c] shadow" />
    </div>
  </div>;
}
