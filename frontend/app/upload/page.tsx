"use client";
import React, { useRef, useEffect } from 'react';
import { useVideoStore } from '../../store/videoStore';
import { useRouter } from 'next/navigation';
import { backendUrl, saveProjectCues, uploadProject } from '../../lib/projects';

// Sample cues (pre‑made, 2‑3 seconds each)
const SAMPLE_CUES = [
  { start: 0, end: 2, text: 'Welcome to CaptionKit!' },
  { start: 2, end: 4, text: 'Create subtitles for your reels' },
  { start: 4, end: 6, text: 'Supports Indian languages' },
];

export default function UploadPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { videoUrl, setVideoData, setCues, setProjectId, language, style } = useVideoStore();
  const router = useRouter();
  const openUploadedProject = async (file: File) => {
    const project = await uploadProject(file, language, style);
    setVideoData(`${backendUrl}/media/${project.id}`, project.title, project.size, project.duration);
    setProjectId(project.id); setCues(SAMPLE_CUES);
    await saveProjectCues(project.id, SAMPLE_CUES);
    router.push(`/editor?project=${encodeURIComponent(project.id)}`);
  };

  // Load sample video and cues
  const loadSample = () => {
    const sampleUrl = '/sample.mp4';
    void fetch(sampleUrl).then(async (response) => {
      if (!response.ok) throw new Error('Sample asset unavailable');
      const blob = await response.blob();
      await openUploadedProject(new File([blob], 'sample.mp4', { type: blob.type || 'video/mp4' }));
    }).catch(() => {
      setVideoData(sampleUrl, 'sample.mp4', 0, 0);
      setCues(SAMPLE_CUES);
      router.push('/editor');
    });
  };

  // When user selects a file, create object URL and get duration before navigating
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void uploadProject(file, language, style).then((project) => {
        setVideoData(`${backendUrl}/media/${project.id}`, project.title, project.size, project.duration);
        setProjectId(project.id);
        router.push(`/editor?project=${encodeURIComponent(project.id)}`);
      }).catch((error) => console.error('Project upload failed:', error));
    }
  };

  // Auto‑play when video URL changes
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [videoUrl]);

  return (
    <div className="flex flex-col items-center p-6 space-y-6">
      <h1 className="text-2xl font-bold text-primary">Upload Your Video</h1>
      <div className="flex gap-4 items-center">
        <input
          type="file"
          accept="video/*"
          onChange={onFileChange}
          className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
        />
        <button
          onClick={loadSample}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition"
        >
          Try a Sample
        </button>
      </div>

      {videoUrl && (
        <div className="w-full max-w-2xl">
          <video
            ref={videoRef}
            className="w-full rounded-lg shadow-lg"
            controls
            poster="/sample-poster.png"
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      )}
    </div>
  );
}
