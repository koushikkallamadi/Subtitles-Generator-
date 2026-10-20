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
  setVideoData: (url: string, name: string, size: number, dur: number) => void;
  setCues: (cues: Cue[]) => void;
}

export const useVideoStore = create<VideoState>()(
  persist(
    (set) => ({
      videoUrl: null,
      cues: [],
      projectName: '',
      fileSize: 0,
      duration: 0,
      setVideoData: (url, name, size, dur) =>
        set({ videoUrl: url, projectName: name, fileSize: size, duration: dur, cues: [] }),
      setCues: (cues) => set({ cues }),
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
