import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_STYLE, mergeCaptionStyle, validateCaptionStyle } from '../lib/captionStyle';
import type { CaptionStyle, CaptionStylePatch } from '../lib/captionStyle';
import { detectCaptionPreset } from '../lib/captionPresets';
import { syncCueWords } from '../lib/cueTiming';

import type { WordTimestamp } from '../lib/captionStyle';
export type { WordTimestamp } from '../lib/captionStyle';
export type Cue = {
  start: number;
  end: number;
  text: string;
  linked: boolean;
  words?: WordTimestamp[];
  manuallyEdited?: boolean;
  timing_quality?: "aligned" | "estimated";
};

export type { CaptionStyle } from '../lib/captionStyle';
export const DEFAULT_CAPTION_STYLE = DEFAULT_STYLE;

type VideoState = {
  videoUrl: string | null; cues: Cue[]; projectName: string; fileSize: number; duration: number; language: string;
  projectId: string | null; savingState: 'saved' | 'unsaved' | 'saving' | 'error';
  maxWordsPerLine: number; maxLinesPerSubtitle: number; originalCues: Cue[]; style: string; timingOffset: number;
  captionStyle: CaptionStyle;
  selectedCaptionPreset: string;
  selectedCueIndex: number | null;
  undoCueHistory: Cue[][]; redoCueHistory: Cue[][];
  setVideoData: (url: string, name: string, size: number, dur: number) => void;
  setProjectId: (id: string | null) => void; setSavingState: (state: 'saved' | 'unsaved' | 'saving' | 'error') => void;
  setCues: (cues: Partial<Cue>[]) => void; setLinked: (index: number, linked: boolean) => void;
  setCueTimingState: (cues: Cue[]) => void; recordCueUndo: (before: Cue[]) => void; undoCueTiming: () => void; redoCueTiming: () => void;
  setLanguage: (language: string) => void; setStyle: (style: string) => void; setTimingOffset: (offset: number) => void;
  setCaptionStyle: (patch: CaptionStylePatch) => void; applyCaptionPreset: (style: CaptionStyle) => void;
  setSelectedCue: (index: number | null) => void; setMaxWordsPerLine: (max: number) => void; setMaxLinesPerSubtitle: (max: number) => void;
  setOriginalCues: (cues: Cue[]) => void; resetCues: () => void; updateCue: (index: number, cue: Partial<Cue>) => void;
  deleteCue: (index: number) => void; mergeCueWithNext: (index: number) => void; addCueAfter: (index: number) => void;
  splitCue: (index: number, text: string, cursor: number) => void; resegmentCues: (maxWords: number, lines: number) => void;
  clearVideo: () => void;
};

function wordsForCue(cue: Cue): WordTimestamp[] {
  return syncCueWords(cue.text, cue.start, cue.end, cue.words);
}

function segment(words: WordTimestamp[], maxWords: number, lines: number): Cue[] {
  const result: Cue[] = [];
  let group: WordTimestamp[] = [];
  const limit = maxWords * lines;
  const flush = () => {
    if (!group.length) return;
    const start = group[0].start;
    const end = Math.max(group[group.length - 1].end, start + 0.3);
    result.push({ start, end, text: group.map((word) => word.text).join(' '), words: group, linked: true });
    group = [];
  };
  for (const word of words) {
    const previous = group[group.length - 1];
    if (previous && (word.start - previous.end > 0.4 || /[.!?।॥]$/.test(previous.text) || group.length >= limit)) flush();
    group.push(word);
  }
  flush();
  return result;
}

export const useVideoStore = create<VideoState>()(persist((set) => ({
  videoUrl: null, cues: [], projectName: '', fileSize: 0, duration: 0, language: 'Hindi', projectId: null, savingState: 'saved',
  style: 'roman', timingOffset: 0, captionStyle: DEFAULT_CAPTION_STYLE, selectedCaptionPreset: 'Highlight', maxWordsPerLine: 4, maxLinesPerSubtitle: 2, originalCues: [], selectedCueIndex: null, undoCueHistory: [], redoCueHistory: [],
  setVideoData: (url, name, size, dur) => set({ videoUrl: url, projectName: name, fileSize: size, duration: dur, cues: [], originalCues: [], projectId: null, savingState: 'saved' }),
  setProjectId: (projectId) => set({ projectId }), setSavingState: (savingState) => set({ savingState }),
  setCues: (items) => set((state) => {
    const cues = items.map((item) => {
      const cue = { ...item, linked: item.linked ?? true } as Cue;
      cue.words = wordsForCue(cue);
      cue.manuallyEdited = false;
      return cue;
    });
    return { cues, originalCues: cues.map((cue) => ({ ...cue, words: cue.words?.map((word) => ({ ...word })) })), selectedCueIndex: null, maxWordsPerLine: state.maxWordsPerLine, maxLinesPerSubtitle: state.maxLinesPerSubtitle };
  }),
  setLinked: (index, linked) => set((state) => ({ cues: state.cues.map((cue, i) => i === index ? { ...cue, linked } : cue) })),
  setCueTimingState: (cues) => set({ cues, savingState: 'unsaved' }),
  recordCueUndo: (before) => set((state) => ({ undoCueHistory: [...state.undoCueHistory, before.map((cue) => ({ ...cue, words: cue.words?.map((word) => ({ ...word })) }))].slice(-100), redoCueHistory: [] })),
  undoCueTiming: () => set((state) => {
    if (!state.undoCueHistory.length) return {};
    const previous = state.undoCueHistory[state.undoCueHistory.length - 1];
    const current = state.cues.map((cue) => ({ ...cue, words: cue.words?.map((word) => ({ ...word })) }));
    return { cues: previous, undoCueHistory: state.undoCueHistory.slice(0, -1), redoCueHistory: [...state.redoCueHistory, current], savingState: 'unsaved' };
  }),
  redoCueTiming: () => set((state) => {
    if (!state.redoCueHistory.length) return {};
    const next = state.redoCueHistory[state.redoCueHistory.length - 1];
    const current = state.cues.map((cue) => ({ ...cue, words: cue.words?.map((word) => ({ ...word })) }));
    return { cues: next, undoCueHistory: [...state.undoCueHistory, current].slice(-100), redoCueHistory: state.redoCueHistory.slice(0, -1), savingState: 'unsaved' };
  }),
  setLanguage: (language) => set({ language }), setStyle: (style) => set({ style }), setTimingOffset: (offset) => set({ timingOffset: Math.max(-1, Math.min(1, Number.isFinite(offset) ? offset : 0)), savingState: 'unsaved' }),
  setCaptionStyle: (patch) => set((state) => {
    const captionStyle = mergeCaptionStyle(state.captionStyle, patch);
    return { captionStyle, selectedCaptionPreset: detectCaptionPreset(captionStyle), savingState: 'unsaved' };
  }),
  applyCaptionPreset: (captionStyle) => {
    const validated = validateCaptionStyle(captionStyle);
    set({ captionStyle: validated, selectedCaptionPreset: detectCaptionPreset(validated), savingState: 'unsaved' });
  },
  setSelectedCue: (selectedCueIndex) => set({ selectedCueIndex }),
  setMaxWordsPerLine: (maxWordsPerLine) => set({ maxWordsPerLine }), setMaxLinesPerSubtitle: (maxLinesPerSubtitle) => set({ maxLinesPerSubtitle }),
  setOriginalCues: (originalCues) => set({ originalCues }),
  resetCues: () => set((state) => ({ cues: state.originalCues.map((cue) => ({ ...cue, words: cue.words?.map((word) => ({ ...word })), manuallyEdited: false })), selectedCueIndex: null, maxWordsPerLine: 4, maxLinesPerSubtitle: 2, timingOffset: 0 })),
  updateCue: (index, patch) => set((state) => ({ cues: state.cues.map((cue, i) => {
    if (i !== index) return cue;
    const updated = { ...cue, ...patch, manuallyEdited: true };
    if (patch.text !== undefined) updated.words = wordsForCue(updated);
    return updated;
  }) })),
  deleteCue: (index) => set((state) => ({ cues: state.cues.filter((_, i) => i !== index), selectedCueIndex: null })),
  mergeCueWithNext: (index) => set((state) => {
    if (index < 0 || index >= state.cues.length - 1) return {};
    const a = state.cues[index], b = state.cues[index + 1];
    const merged: Cue = { ...a, end: b.end, text: `${a.text} ${b.text}`.trim(), words: [...wordsForCue(a), ...wordsForCue(b)], manuallyEdited: true };
    const cues = [...state.cues]; cues.splice(index, 2, merged); return { cues };
  }),
  addCueAfter: (index) => set((state) => {
    const after = state.cues[index]; if (!after) return {};
    const cues = [...state.cues]; cues.splice(index + 1, 0, { start: after.end + 0.1, end: after.end + 0.5, text: '', words: [], linked: true, manuallyEdited: true }); return { cues };
  }),
  splitCue: (index, text, cursor) => set((state) => {
    const cue = state.cues[index]; if (!cue) return {};
    const leftText = text.slice(0, cursor).trim(), rightText = text.slice(cursor).trim();
    const allWords = wordsForCue(cue), splitAt = text.slice(0, cursor).trim().split(/\s+/).filter(Boolean).length;
    if (!leftText || !rightText || splitAt < 1 || splitAt >= allWords.length) return {};
    const leftWords = allWords.slice(0, splitAt), rightWords = allWords.slice(splitAt);
    const middle = rightWords[0].start;
    const left = { ...cue, text: leftText, words: leftWords, end: Math.max(leftWords.at(-1)!.end, cue.start + 0.3), manuallyEdited: true };
    const right = { ...cue, start: middle, text: rightText, words: rightWords, manuallyEdited: true };
    const cues = [...state.cues]; cues.splice(index, 1, left, right); return { cues };
  }),
  resegmentCues: (maxWordsPerLine, maxLinesPerSubtitle) => set((state) => ({
    cues: segment(state.cues.flatMap(wordsForCue), maxWordsPerLine, maxLinesPerSubtitle), maxWordsPerLine, maxLinesPerSubtitle, selectedCueIndex: null,
  })),
  clearVideo: () => set({ videoUrl: null, cues: [], originalCues: [], projectName: '', fileSize: 0, duration: 0, language: 'Hindi', style: 'roman', timingOffset: 0, captionStyle: DEFAULT_CAPTION_STYLE, selectedCaptionPreset: 'Highlight', selectedCueIndex: null, projectId: null, savingState: 'saved' }),
}), { name: 'video-store', partialize: ({ videoUrl, undoCueHistory, redoCueHistory, ...rest }) => {
  if (videoUrl?.startsWith('blob:')) return rest;
  return { ...rest, videoUrl };
}, merge: (persisted, current) => {
  const restored = persisted as Partial<VideoState> | undefined;
  const captionStyle = validateCaptionStyle(restored?.captionStyle || DEFAULT_STYLE);
  const timingOffset = Number(restored?.timingOffset ?? 0);
  return { ...current, ...restored, timingOffset: Math.max(-1, Math.min(1, Number.isFinite(timingOffset) ? timingOffset : 0)), captionStyle, selectedCaptionPreset: detectCaptionPreset(captionStyle) };
} }));
