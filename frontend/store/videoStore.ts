import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WordTimestamp = { text: string; start: number; end: number };
export type Cue = {
  start: number;
  end: number;
  text: string;
  linked: boolean;
  words?: WordTimestamp[];
  manuallyEdited?: boolean;
};

export type CaptionStyle = {
  preset: string;
  linked: boolean;
  x: number;
  y: number;
  size: number;
  font: string;
  bold: boolean;
  italic: boolean;
  textColor: string;
  wordHighlight: boolean;
  highlightTextColor: string;
  highlightBoxColor: string;
  highlightOpacity: number;
  reveal: boolean;
  animation: string;
  stroke: boolean;
  strokeWidth: number;
  strokeColor: string;
  background: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  backgroundPadding: number;
  backgroundRadius: number;
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  preset: 'Highlight', linked: true, x: 50, y: 86, size: 100, font: 'System', bold: true, italic: false,
  textColor: '#ffffff', wordHighlight: true, highlightTextColor: '#171717', highlightBoxColor: '#f5d95d', highlightOpacity: 100,
  reveal: false, animation: 'None', stroke: true, strokeWidth: 2, strokeColor: '#111111', background: false,
  backgroundColor: '#111111', backgroundOpacity: 75, backgroundPadding: 10, backgroundRadius: 10,
};

type VideoState = {
  videoUrl: string | null; cues: Cue[]; projectName: string; fileSize: number; duration: number; language: string;
  projectId: string | null; savingState: 'saved' | 'unsaved' | 'saving' | 'error';
  maxWordsPerLine: number; maxLinesPerSubtitle: number; originalCues: Cue[]; style: string; timingOffset: number;
  captionStyle: CaptionStyle;
  selectedCueIndex: number | null;
  setVideoData: (url: string, name: string, size: number, dur: number) => void;
  setProjectId: (id: string | null) => void; setSavingState: (state: 'saved' | 'unsaved' | 'saving' | 'error') => void;
  setCues: (cues: Partial<Cue>[]) => void; setLinked: (index: number, linked: boolean) => void;
  setLanguage: (language: string) => void; setStyle: (style: string) => void; setTimingOffset: (offset: number) => void;
  setCaptionStyle: (patch: Partial<CaptionStyle>) => void; applyCaptionPreset: (style: CaptionStyle) => void;
  setSelectedCue: (index: number | null) => void; setMaxWordsPerLine: (max: number) => void; setMaxLinesPerSubtitle: (max: number) => void;
  setOriginalCues: (cues: Cue[]) => void; resetCues: () => void; updateCue: (index: number, cue: Partial<Cue>) => void;
  deleteCue: (index: number) => void; mergeCueWithNext: (index: number) => void; addCueAfter: (index: number) => void;
  splitCue: (index: number, text: string, cursor: number) => void; resegmentCues: (maxWords: number, lines: number) => void;
  clearVideo: () => void;
};

function wordsForCue(cue: Cue): WordTimestamp[] {
  if (cue.words?.length) return cue.words;
  const parts = cue.text.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const span = Math.max(0.3, cue.end - cue.start);
  return parts.map((text, i) => ({ text, start: cue.start + span * i / parts.length, end: cue.start + span * (i + 1) / parts.length }));
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
  style: 'roman', timingOffset: 0, captionStyle: DEFAULT_CAPTION_STYLE, maxWordsPerLine: 4, maxLinesPerSubtitle: 2, originalCues: [], selectedCueIndex: null,
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
  setLanguage: (language) => set({ language }), setStyle: (style) => set({ style }), setTimingOffset: (timingOffset) => set({ timingOffset }),
  setCaptionStyle: (patch) => set((state) => ({ captionStyle: { ...state.captionStyle, ...patch, preset: 'Custom' }, savingState: 'unsaved' })),
  applyCaptionPreset: (captionStyle) => set({ captionStyle: { ...captionStyle }, savingState: 'unsaved' }),
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
  clearVideo: () => set({ videoUrl: null, cues: [], originalCues: [], projectName: '', fileSize: 0, duration: 0, language: 'Hindi', style: 'roman', timingOffset: 0, captionStyle: DEFAULT_CAPTION_STYLE, selectedCueIndex: null, projectId: null, savingState: 'saved' }),
}), { name: 'video-store', partialize: (state) => {
  if (state.videoUrl?.startsWith('blob:')) { const { videoUrl, ...rest } = state; return rest; }
  return state;
} }));
