"use client";
import React, { useRef, useEffect, useState } from 'react';
import { useVideoStore } from '../../store/videoStore';
import { useRouter } from 'next/navigation';
import { saveProjectCues } from '../../lib/projects';
import { createProjectFromLocalFile } from '../../lib/localProject';
import { useAuth } from '../../components/AuthProvider';
import { BRAND } from '../../lib/brand';
import TransferProgress from '../../components/TransferProgress';
import type { TransferProgress as TransferProgressData } from '../../lib/uploadRequest';

// Sample cues (pre‑made, 2‑3 seconds each)
const SAMPLE_CUES = [
  { start: 0, end: 2, text: `Welcome to ${BRAND.name}!` },
  { start: 2, end: 4, text: 'Create subtitles for your reels' },
  { start: 4, end: 6, text: 'Supports Indian languages' },
];

export default function UploadPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { videoUrl, setVideoData, setCues, setProjectId, setLocalVideoFile, setProjectMedia, setAudioPreparation, setAudioPreparationMessage, setTransferProgress, language, style } = useVideoStore();
  const router = useRouter();
  const { requireLogin, loading: authLoading } = useAuth();
  const [uploadError, setUploadError] = useState('');
  const [transfer, setTransfer] = useState<TransferProgressData | null>(null);
  const prepareFile = async (file: File, sample = false) => {
    setUploadError('');
    setTransfer(null);
    const localUrl = URL.createObjectURL(file);
    setVideoData(localUrl, file.name, file.size, 0);
    setLocalVideoFile(file);
    setAudioPreparationMessage('');
    setAudioPreparation('extracting', 0);
    router.push('/editor');
    try {
      const project = await createProjectFromLocalFile(file, language, style, (stage, progress, currentTransfer) => {
        setAudioPreparation(stage === 'uploading-audio' ? 'uploading' : stage === 'uploading-video' ? 'uploading-video' : 'extracting', progress);
        if (currentTransfer) { setTransfer(currentTransfer); setTransferProgress(currentTransfer); }
      }, () => setAudioPreparationMessage('Audio extraction failed, uploading the video instead.'));
      setProjectId(project.id);
      setProjectMedia(project.media_available, project.audio_available ?? true);
      useVideoStore.setState({ duration: project.duration });
      setAudioPreparationMessage(project.media_available && !project.audio_available ? 'Video uploaded as fallback because audio extraction failed.' : '');
      setAudioPreparation('ready', 100);
      if (sample) {
        setCues(SAMPLE_CUES);
        await saveProjectCues(project.id, SAMPLE_CUES);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Project preparation failed.';
      setAudioPreparation('failed', 0);
      setAudioPreparationMessage(message);
      setUploadError(message);
    } finally {
      setTransfer(null);
      setTransferProgress(null);
    }
  };

  // Load sample video and cues
  const loadSample = () => {
    const sampleUrl = '/sample.mp4';
    void fetch(sampleUrl).then(async (response) => {
      if (!response.ok) throw new Error('Sample asset unavailable');
      const blob = await response.blob();
      await prepareFile(new File([blob], 'sample.mp4', { type: blob.type || 'video/mp4' }), true);
    }).catch(() => {
      setVideoData(sampleUrl, 'sample.mp4', 0, 0);
      setCues(SAMPLE_CUES);
      router.push('/editor');
    });
  };

  // When user selects a file, create object URL and get duration before navigating
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void requireLogin(() => { void prepareFile(file); }, '/');
  };

  // Auto‑play when video URL changes
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [videoUrl]);

  return (
    <div className="flex flex-col items-center p-6 space-y-6" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (file) void requireLogin(() => { void prepareFile(file); }, '/');
    }}>
      <h1 className="text-2xl font-bold text-primary">Upload Your Video</h1>
      {transfer && <TransferProgress progress={transfer} />}
      <div className="flex gap-4 items-center">
        <input ref={fileInputRef} type="file" accept="video/*,audio/*" onChange={onFileChange} className="hidden" />
        <button type="button" disabled={authLoading} onClick={() => void requireLogin(() => fileInputRef.current?.click(), '/')} className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/80 disabled:opacity-60">Choose your video</button>
        <button
          onClick={loadSample}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition"
        >
          Try a Sample
        </button>
      </div>
      {uploadError && <p role="alert" className="text-sm text-red-300">{uploadError}</p>}

      {videoUrl && (
        <div className="w-full max-w-2xl">
          <video
            ref={videoRef}
            crossOrigin="use-credentials"
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

