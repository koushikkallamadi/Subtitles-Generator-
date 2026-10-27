"use client";

import React, { useEffect, useRef, useState } from "react";
import { useVideoStore } from "../store/videoStore";
import type { Cue } from "../store/videoStore";
import { moveCueSet, resizeCueSet, snapCueTime } from "../lib/cueTiming";
import {
  Scissors,
  Copy,
  Trash2,
  Link as LinkIcon,
  Type,
  Image as ImageIcon,
  Undo2,
  Redo2,
  Minus,
  Maximize,
  Plus,
  Video,
  Volume2,
} from "lucide-react";

interface TimelineProps {
  currentTime: number;
  duration: number;
  fileName?: string;
  onSeek: (time: number) => void;
}

const BASE_PIXELS_PER_SECOND = 100;

function formatShortTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function Timeline({
  currentTime,
  duration,
  fileName,
  onSeek,
}: TimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { cues, timingOffset, selectedCueIndex, undoCueHistory, redoCueHistory } = useVideoStore();
  const [dragView, setDragView] = useState<{ index: number; start: number; end: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ index: number; edge: 'move' | 'start' | 'end'; startX: number; pointerId: number; before: Cue[]; clientX: number; alt: boolean } | null>(null);
  const rafId = useRef(0);
  const suppressClick = useRef(false);
  const timelineDuration = duration > 0 ? duration : 6;

  useEffect(() => {
    if (selectedCueIndex === null) return;
    const container = scrollContainerRef.current;
    const block = container?.querySelector<HTMLElement>(`[data-cue-index="${selectedCueIndex}"]`);
    if (!container || !block) return;
    const blockLeft = block.offsetLeft;
    const blockRight = blockLeft + block.offsetWidth;
    if (blockLeft < container.scrollLeft) container.scrollLeft = blockLeft - 24;
    else if (blockRight > container.scrollLeft + container.clientWidth) container.scrollLeft = blockRight - container.clientWidth + 24;
  }, [selectedCueIndex, cues.length]);

  const updateDrag = (clientX: number, alt: boolean) => {
    const active = drag.current;
    if (!active) return;
    const before = active.before, cue = before[active.index];
    if (!cue) return;
    const delta = (clientX - active.startX) / (BASE_PIXELS_PER_SECOND * zoom);
    const snapPoints = [0, timelineDuration, currentTime - timingOffset, before[active.index - 1]?.end, before[active.index + 1]?.start].filter((point): point is number => Number.isFinite(point));
    let next: Cue[];
    if (active.edge === 'move') {
      const start = snapCueTime(cue.start + delta, snapPoints, alt);
      next = moveCueSet(before, active.index, start - cue.start, timelineDuration);
    } else {
      const raw = (active.edge === 'start' ? cue.start : cue.end) + delta;
      const snapped = snapCueTime(raw, snapPoints, alt);
      next = resizeCueSet(before, active.index, active.edge, snapped, timelineDuration);
    }
    const timingChanged = next.some((item, index) => item.start !== before[index].start || item.end !== before[index].end || item.words?.some((word, wordIndex) => word.start !== before[index].words?.[wordIndex]?.start || word.end !== before[index].words?.[wordIndex]?.end));
    const stateCues = useVideoStore.getState().cues;
    if (timingChanged) useVideoStore.getState().setCueTimingState(next);
    else if (JSON.stringify(stateCues) !== JSON.stringify(before)) useVideoStore.getState().setCueTimingState(before);
    const updated = timingChanged ? next[active.index] : before[active.index];
    setDragView({ index: active.index, start: updated.start, end: updated.end });
  };

  const finishDrag = (event: React.PointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = 0; updateDrag(event.clientX, event.altKey); }
    const after = useVideoStore.getState().cues;
    if (JSON.stringify(active.before) !== JSON.stringify(after)) useVideoStore.getState().recordCueUndo(active.before);
    suppressClick.current = Math.abs(event.clientX - active.startX) > 2;
    drag.current = null;
    setDragView(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    window.setTimeout(() => { suppressClick.current = false; }, 0);
  };

  const startDrag = (event: React.PointerEvent<HTMLElement>, index: number, edge: 'move' | 'start' | 'end') => {
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const before = useVideoStore.getState().cues.map((cue) => ({ ...cue, words: cue.words?.map((word) => ({ ...word })) }));
    drag.current = { index, edge, startX: event.clientX, pointerId: event.pointerId, before, clientX: event.clientX, alt: event.altKey };
    useVideoStore.getState().setSelectedCue(index);
    const cue = before[index];
    setDragView({ index, start: cue.start, end: cue.end });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' || event.target instanceof HTMLElement && event.target.closest('input,textarea,[contenteditable="true"]')) return;
      const state = useVideoStore.getState(), index = state.selectedCueIndex;
      if (index === null) return;
      event.preventDefault();
      const before = state.cues.map((cue) => ({ ...cue, words: cue.words?.map((word) => ({ ...word })) }));
      const next = moveCueSet(before, index, (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 0.5 : 0.05), timelineDuration);
      if (JSON.stringify(before) !== JSON.stringify(next)) { state.setCueTimingState(next); state.recordCueUndo(before); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (rafId.current) cancelAnimationFrame(rafId.current);
      drag.current = null;
    };
  }, [timelineDuration]);

  const safeDuration = timelineDuration;
  const pixelsPerSecond = BASE_PIXELS_PER_SECOND * zoom;
  const clipWidth = safeDuration * pixelsPerSecond;
  const totalRulerWidth = Math.max(clipWidth + 200, Math.min(800, scrollContainerRef.current?.clientWidth || 800));
  const totalSeconds = Math.ceil(totalRulerWidth / pixelsPerSecond);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + scrollContainerRef.current.scrollLeft;
    const newTime = Math.max(0, Math.min(safeDuration, clickX / pixelsPerSecond));
    onSeek(newTime);
  };

  const fitTimeline = () => {
    const visibleWidth = scrollContainerRef.current?.clientWidth;
    if (!visibleWidth) return;
    setZoom(Math.max(0.01, Math.min(8, (visibleWidth - 224) / (safeDuration * BASE_PIXELS_PER_SECOND))));
    scrollContainerRef.current.scrollLeft = 0;
  };
  const playheadLeft = currentTime * pixelsPerSecond;

  return (
    <div className="flex h-[220px] w-full flex-col border-t border-gray-800 bg-[#0d121f] text-gray-300 select-none">
      {/* Toolbar row */}
      <div className="flex h-10 items-center justify-between border-b border-gray-800/80 px-4 text-xs">
        {/* Left tools */}
        <div className="flex items-center space-x-1">
          <span className="font-medium text-gray-200 mr-2 text-xs">Timeline</span>
          <div className="h-4 w-[1px] bg-gray-800 mx-1" />
          <button disabled className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40">
            <Scissors className="h-3.5 w-3.5" />
          </button>
          <button disabled className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button disabled className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button disabled className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40">
            <LinkIcon className="h-3.5 w-3.5" />
          </button>
          <button disabled className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40">
            <Type className="h-3.5 w-3.5" />
          </button>
          <button disabled className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40">
            <ImageIcon className="h-3.5 w-3.5" />
          </button>
          <div className="h-4 w-[1px] bg-gray-800 mx-1" />
          <button disabled={!undoCueHistory.length} onClick={() => useVideoStore.getState().undoCueTiming()} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-40" aria-label="Undo timing edit" title="Undo timing edit">
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button disabled={!redoCueHistory.length} onClick={() => useVideoStore.getState().redoCueTiming()} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-40" aria-label="Redo timing edit" title="Redo timing edit">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Right zoom controls */}
        <div className="flex items-center space-x-1.5 text-gray-400">
          <span className="text-[11px] font-mono mr-1">{zoom.toFixed(1)}x</span>
          <button type="button" aria-label="Zoom timeline out" title="Zoom timeline out" disabled={zoom <= 0.01} onClick={() => setZoom((value) => Math.max(0.01, Number((value / 1.25).toFixed(3))))} className="p-1 text-gray-400 hover:text-white disabled:opacity-40">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label="Fit timeline" title="Fit timeline" onClick={fitTimeline} className="p-1 text-gray-400 hover:text-white">
            <Maximize className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label="Zoom timeline in" title="Zoom timeline in" disabled={zoom >= 8} onClick={() => setZoom((value) => Math.min(8, Number((value * 1.25).toFixed(3))))} className="p-1 text-gray-400 hover:text-white disabled:opacity-40">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main timeline area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left track headers column (120px) */}
        <div className="flex w-[120px] flex-shrink-0 flex-col border-r border-gray-800 bg-[#0f1423] text-xs">
          {/* Header spacer aligned with ruler */}
          <div className="h-6 border-b border-gray-800/80" />

          {/* Video track header */}
          <div className="flex h-12 items-center justify-between px-3 border-b border-gray-800/60">
            <div className="flex items-center space-x-1.5 truncate">
              <Video className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate text-gray-300 font-medium">Video</span>
            </div>
            <Volume2 className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
          </div>

          {/* Subtitles track header */}
          <div className="flex h-12 items-center px-3 border-b border-gray-800/60">
            <span className="text-gray-400 font-medium truncate">Subtitles</span>
          </div>
        </div>

        {/* Right scrollable tracks and ruler area */}
        <div
          ref={scrollContainerRef}
          onClick={(event) => { if (suppressClick.current) { event.stopPropagation(); suppressClick.current = false; return; } handleContainerClick(event); }}
          className="relative flex-1 overflow-x-auto overflow-y-hidden cursor-pointer"
        >
          <div
            style={{ width: `${totalRulerWidth}px` }}
            className="relative h-full"
          >
            {/* Ruler row */}
            <div className="relative h-6 border-b border-gray-800 bg-[#0c101c]">
              {Array.from({ length: totalSeconds }).map((_, sec) => (
                <div
                  key={sec}
                  style={{ left: `${sec * pixelsPerSecond}px` }}
                  className="absolute top-0 h-full flex flex-col justify-end"
                >
                  <span className="text-[10px] font-mono text-gray-500 pl-1 leading-none">
                    {formatShortTime(sec)}
                  </span>
                  <div className="h-1.5 w-[1px] bg-gray-700" />
                </div>
              ))}
            </div>

            {/* Video track row */}
            <div className="relative h-12 border-b border-gray-800/60 py-1.5 px-0.5 bg-[#0b0f1a]/50">
              <div
                style={{ width: `${clipWidth}px` }}
                className="group relative flex h-full flex-col justify-center rounded-lg border border-blue-500/40 bg-gradient-to-r from-blue-950/70 to-indigo-950/60 px-2.5 text-white shadow-sm overflow-hidden"
              >
                <span className="truncate text-[11px] font-medium leading-tight">
                  {fileName || "Video Clip"}
                </span>
                <span className="text-[10px] text-gray-400 leading-tight">
                  0:00 - {formatShortTime(safeDuration)}
                </span>
              </div>
            </div>

            {/* Subtitles track row */}
            <div className="relative h-12 border-b border-gray-800/60 bg-[#0b0f1a]/30">
              {cues &&
                cues.map((cue, idx) => {
                  const cueLeft = (cue.start + timingOffset) * pixelsPerSecond;
                  const cueWidth = Math.max((cue.end - cue.start) * pixelsPerSecond, 20);
                  const isSelected = idx === selectedCueIndex;
                  return (
                    <div
                      key={idx}
                      data-cue-index={idx}
                      style={{ left: `${cueLeft}px`, width: `${cueWidth}px` }}
                      className={`group/cue absolute top-1.5 bottom-1.5 flex items-center rounded-md border ${isSelected ? 'border-yellow-400' : 'border-orange-500/50'} bg-gradient-to-r from-orange-950/70 to-amber-950/60 px-2 text-white shadow-sm text-ellipsis whitespace-nowrap cursor-grab touch-none hover:border-orange-400 ${drag?.current?.index === idx ? 'z-30 cursor-grabbing' : ''}`}
                      title={`${cue.start}s - ${cue.end}s: ${cue.text}`}
                      onClick={(event) => {
                        if (suppressClick.current) { event.stopPropagation(); suppressClick.current = false; return; }
                        // Prevent the track background handler from seeking to the click point.
                        event.stopPropagation();
                        useVideoStore.getState().setSelectedCue(idx);
                        onSeek(Math.max(0, cue.start + timingOffset));
                      }}
                      onPointerDown={(event) => startDrag(event, idx, 'move')}
                      onPointerMove={(event) => {
                        if (drag.current?.pointerId !== event.pointerId) return;
                        drag.current.clientX = event.clientX; drag.current.alt = event.altKey;
                        if (!rafId.current) rafId.current = requestAnimationFrame(() => { rafId.current = 0; const active = drag.current; if (active) updateDrag(active.clientX, active.alt); });
                      }}
                      onPointerUp={finishDrag}
                      onPointerCancel={finishDrag}
                    >
                      <span className="truncate text-[11px] font-medium leading-none text-orange-100">
                        {cue.text}
                      </span>
                      <button type="button" aria-label={`Resize cue ${idx + 1} start`} title="Drag to resize start" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => startDrag(event, idx, 'start')} onPointerMove={(event) => {
                        if (drag.current?.pointerId !== event.pointerId) return;
                        drag.current.clientX = event.clientX; drag.current.alt = event.altKey;
                        if (!rafId.current) rafId.current = requestAnimationFrame(() => { rafId.current = 0; const active = drag.current; if (active) updateDrag(active.clientX, active.alt); });
                      }} onPointerUp={finishDrag} onPointerCancel={finishDrag} className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize touch-none border-r border-orange-200/60 bg-orange-300/20 hover:bg-orange-200/60" />
                      <button type="button" aria-label={`Resize cue ${idx + 1} end`} title="Drag to resize end" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => startDrag(event, idx, 'end')} onPointerMove={(event) => {
                        if (drag.current?.pointerId !== event.pointerId) return;
                        drag.current.clientX = event.clientX; drag.current.alt = event.altKey;
                        if (!rafId.current) rafId.current = requestAnimationFrame(() => { rafId.current = 0; const active = drag.current; if (active) updateDrag(active.clientX, active.alt); });
                      }} onPointerUp={finishDrag} onPointerCancel={finishDrag} className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize touch-none border-l border-orange-200/60 bg-orange-300/20 hover:bg-orange-200/60" />
                      {dragView?.index === idx && <span className="pointer-events-none absolute -top-5 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-1.5 py-0.5 font-mono text-[9px] text-white">{dragView.start.toFixed(2)}–{dragView.end.toFixed(2)}s</span>}
                    </div>
                  );
                })}
            </div>

            {/* Playhead */}
            <div
              style={{ left: `${playheadLeft}px` }}
              className="pointer-events-none absolute top-0 bottom-0 z-20 flex flex-col items-center"
            >
              {/* Playhead Head (Triangle/Pill) */}
              <div className="h-3 w-3 bg-orange-500 rounded-sm rotate-45 -mt-1 shadow-md" />
              {/* Playhead Line */}
              <div className="w-[2px] flex-1 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
