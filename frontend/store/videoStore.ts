import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Cue = {
  start: number; // seconds
  end: number; // seconds
  text: string;
  linked: boolean; // default true, indicates cue linked for timeline moves
};

interface VideoState {
  videoUrl: string | null;
  cues: Cue[];
  projectName: string;
  fileSize: number;
  duration: number;
  language: string;
  // Transcript settings
  maxWordsPerLine: number; // default 4
  maxLinesPerSubtitle: number; // default 2
  // Store original generated cues for reset
  originalCues: Cue[];

  style: string;
  timingOffset: number; // seconds, can be negative
  selectedCueIndex: number | null; // currently selected cue
  setVideoData: (url: string, name: string, size: number, dur: number) => void;
  setCues: (cues: Partial<Cue>[]) => void;
  setLinked: (index: number, linked: boolean) => void;
  setLanguage: (language: string) => void;
  setStyle: (style: string) => void;
  setTimingOffset: (offset: number) => void;
  setSelectedCue: (index: number | null) => void;
  // New actions
  setMaxWordsPerLine: (max: number) => void;
  setMaxLinesPerSubtitle: (max: number) => void;
  setOriginalCues: (cues: Cue[]) => void;
  resetCues: () => void;
  updateCue: (index: number, cue: Partial<Cue>) => void;
  deleteCue: (index: number) => void;
  mergeCueWithNext: (index: number) => void;
  addCueAfter: (index: number) => void;
  clearVideo: () => void;
}

export const useVideoStore = create<VideoState>()(
  persist(
    (set) => ({
      videoUrl: null,
      cues: [],
      projectName: '',
      fileSize: 0,
      duration: 0,
      language: 'Hindi',
      style: 'roman',
      timingOffset: 0,
      maxWordsPerLine: 4,
      maxLinesPerSubtitle: 2,
      originalCues: [],
      selectedCueIndex: null,
      setVideoData: (url, name, size, dur) =>
        set({
          videoUrl: url,
          projectName: name,
          fileSize: size,
          duration: dur,
          cues: [],
        }),
      // Set cues, ensuring each cue has a linked flag (default true)
      // Accept partial cues and ensure linked flag defaults to true
  setCues: (cues: Partial<Cue>[]) =>
        set({
          cues: cues.map((c) => ({ ...c, linked: c.linked ?? true } as Cue)),
        }),
      // Toggle linked flag for a specific cue index
      setLinked: (index, linked) =>
        set((state) => ({
          cues: state.cues.map((c, i) => (i === index ? { ...c, linked } : c)),
        })),
      setLanguage: (language) =>
        set((state) => {
          // If changing to English, style should be 'roman' (or standard)
          // For Indian languages, default to 'roman' if not already roman or native
          return { language };
        }),
      setStyle: (style) => set({ style }),
      setTimingOffset: (offset) => set({ timingOffset: offset }),
      setSelectedCue: (index) => set({ selectedCueIndex: index }),
      setMaxWordsPerLine: (max) => set({ maxWordsPerLine: max }),
      setMaxLinesPerSubtitle: (max) => set({ maxLinesPerSubtitle: max }),
      setOriginalCues: (cues) => set({ originalCues: cues }),
      resetCues: () => set((state) => ({ cues: state.originalCues.map((c) => ({ ...c })) })),
      updateCue: (index, cue) => set((state) => ({ cues: state.cues.map((c,i) => i===index ? { ...c, ...cue } : c) })),
      deleteCue: (index) => set((state) => ({ cues: state.cues.filter((_,i) => i !== index) })),
      mergeCueWithNext: (index) => set((state) => {
        if (index < 0 || index >= state.cues.length - 1) return {};
        const cue = state.cues[index];
        const next = state.cues[index + 1];
        const merged = { ...cue, end: next.end, text: `${cue.text} ${next.text}` };
        const updated = [...state.cues];
        updated.splice(index, 2, merged);
        return { cues: updated };
      }),
      addCueAfter: (index) => set((state) => {
        const after = state.cues[index];
        const newCue = { start: after.end + 0.1, end: after.end + 0.5, text: '', linked: true };
        const updated = [...state.cues];
        updated.splice(index + 1, 0, newCue);
        return { cues: updated };
      }),
      clearVideo: () =>
        set({
          videoUrl: null,
          cues: [],
          projectName: '',
          fileSize: 0,
          duration: 0,
          language: 'Hindi',
          style: 'roman',
      timingOffset: 0,
        }),
    }),
    {
      name: 'video-store',
      partialize: (state) => {
        if (state.videoUrl?.startsWith('blob:')) {
          const { videoUrl, ...rest } = state;
          return rest;
        }
        return state;
      },
    }
  )
);
