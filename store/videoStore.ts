import { create } from 'zustand';

type Cue = {
  start: number; // seconds
  end: number; // seconds
  text: string;
};

interface VideoState {
  videoUrl: string | null;
  cues: Cue[];
  setVideoUrl: (url: string) => void;
  setCues: (cues: Cue[]) => void;
}

export const useVideoStore = create<VideoState>((set) => ({
  videoUrl: null,
  cues: [],
  setVideoUrl: (url) => set({ videoUrl: url }),
  setCues: (cues) => set({ cues }),
}));
