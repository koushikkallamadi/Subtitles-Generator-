import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Cue = {
  start: number; // seconds
  end: number; // seconds
  text: string;
};

interface VideoState {
  videoUrl: string | null;
  cues: Cue[];
  projectName: string;
  fileSize: number;
  duration: number;
  language: string;
  style: string;
  timingOffset: number; // seconds, can be negative
  setVideoData: (url: string, name: string, size: number, dur: number) => void;
  setCues: (cues: Cue[]) => void;
  setLanguage: (language: string) => void;
  setStyle: (style: string) => void;
  setTimingOffset: (offset: number) => void;
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
      setVideoData: (url, name, size, dur) =>
        set({
          videoUrl: url,
          projectName: name,
          fileSize: size,
          duration: dur,
          cues: [],
        }),
      setCues: (cues) => set({ cues }),
      setLanguage: (language) =>
        set((state) => {
          // If changing to English, style should be 'roman' (or standard)
          // For Indian languages, default to 'roman' if not already roman or native
          return { language };
        }),
      setStyle: (style) => set({ style }),
      setTimingOffset: (offset) => set({ timingOffset: offset }),
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
