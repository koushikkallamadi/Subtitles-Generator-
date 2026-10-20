"use client";
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useVideoStore } from '../store/videoStore';

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      {/* Hero Card */}
      <div className="flex flex-col md:flex-row items-center bg-gray-800 rounded-2xl p-6 md:p-10 max-w-5xl w-full mt-8">
        {/* Left side: language pills */}
        <div className="flex flex-col space-y-2 md:mr-8 mb-4 md:mb-0">
          {['Hinglish', 'Marathi', 'Tamil', 'Urdu', 'English'].map((lang) => (
            <span key={lang} className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm">
              {lang}
            </span>
          ))}
        </div>
        {/* Center: phone mockup with animated subtitle */}
        <div className="relative w-64 h-112 md:w-80 md:h-[480px] bg-gray-700 rounded-3xl overflow-hidden shadow-lg">
          <video autoPlay muted loop className="w-full h-full object-cover" src="/sample.mp4" />
          <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm font-medium animate-pulse">
            Captions appear here…
          </div>
        </div>
        {/* Right side: headline and actions */}
        <div className="flex flex-col items-start md:ml-8 mt-6 md:mt-0">
          <h1 className="text-4xl font-extrabold mb-4">
            Drop a reel, get <span className="bg-gradient-to-r from-[#FF7E5F] to-[#FFB88C] bg-clip-text text-transparent">captions</span> in seconds.
          </h1>
          <p className="text-gray-300 mb-6 max-w-sm">
            Upload your short video and let AI generate subtitles in multiple Indian languages.
          </p>
          <div className="flex space-x-4 mb-4">
<button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition">
  Add your video
</button>
<input
  type="file"
  accept="video/*,audio/*"
  ref={fileInputRef}
  style={{ display: 'none' }}
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) {
      alert('File size exceeds 500 MB limit');
      return;
    }
    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      alert('Unsupported file type');
      return;
    }
    const url = URL.createObjectURL(file);
    useVideoStore.getState().setVideoData(url, file.name, file.size, 0);
    router.push('/editor');
  }}
/>
<Link href="/upload" className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition">Try a Sample</Link>
          </div>
          <p className="text-gray-500 text-sm">
            MP4, MOV, MP3 and more · up to 500 MB · or drag a file anywhere
          </p>
        </div>
      </div>
      {/* Global Drag & Drop overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (!file) return;
          if (file.size > 500 * 1024 * 1024) {
            alert('File size exceeds 500 MB limit');
            return;
          }
          if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
            alert('Unsupported file type');
            return;
          }
          const url = URL.createObjectURL(file);
          useVideoStore.getState().setVideoData(url, file.name, file.size, 0);
          router.push('/editor');
        }}
      />
    </div>
  );
}
