import React from 'react';
import { useVideoStore } from '../store/videoStore';

export default function SettingsPanel() {
  const timingOffset = useVideoStore((state) => state.timingOffset);
  const setTimingOffset = useVideoStore((state) => state.setTimingOffset);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setTimingOffset(value);
  };

  return (
    <div className="p-4 border-b border-gray-800">
      <h2 className="text-sm font-medium text-gray-300 mb-2">Timing Offset (seconds)</h2>
      <input
        type="number"
        step="0.01"
        value={timingOffset}
        onChange={handleChange}
        className="w-full rounded bg-gray-900 text-white p-2"
      />
    </div>
  );
}
