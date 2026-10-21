import React, { useState } from 'react';
import SettingsPanel from './SettingsPanel';
import CueCard from './CueCard';
import { useVideoStore } from '../store/videoStore';

export default function TranscriptTab({ onRegenerate }: { onRegenerate?: () => void }) {
  const { cues, resetCues } = useVideoStore();
  const [showSettings, setShowSettings] = useState(true);
  const [showCues, setShowCues] = useState(true);

  const handleReset = () => {
    resetCues();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-gray-800 bg-[#0d121f]">
        <button onClick={handleReset} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600">
          Reset
        </button>
        <button onClick={onRegenerate} className="px-2 py-1 bg-blue-600 rounded text-xs hover:bg-blue-500">
          Regenerate
        </button>
      </div>

      {/* Transcript Settings */}
      <div className="border-b border-gray-800">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full text-left px-3 py-2 bg-[#0f1423] hover:bg-[#11172a]"
        >
          Transcript settings
        </button>
        {showSettings && <SettingsPanel />}
      </div>

      {/* Cues List */}
      <div className="flex-1 overflow-y-auto">
        <button
          onClick={() => setShowCues(!showCues)}
          className="w-full text-left px-3 py-2 bg-[#0f1423] hover:bg-[#11172a]"
        >
          Cues ({cues.length})
        </button>
        {showCues && (
          <div className="p-2 space-y-2">
            {cues.map((cue, idx) => (
              <CueCard key={idx} cue={cue} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
