import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useVideoStore, Cue } from '../store/videoStore';

interface CueCardProps {
  cue: Cue;
  index: number;
  maxWordsPerLine?: number;
  maxLinesPerSubtitle?: number;
}

export default function CueCard({ cue, index, maxWordsPerLine = 4, maxLinesPerSubtitle = 2 }: CueCardProps) {
  const setLinked = useVideoStore((state) => state.setLinked);
  const updateCue = useVideoStore((state) => state.updateCue);
  const deleteCue = useVideoStore((state) => state.deleteCue);
  const mergeCueWithNext = useVideoStore((state) => state.mergeCueWithNext);
  const addCueAfter = useVideoStore((state) => state.addCueAfter);
  const setSelectedCue = useVideoStore((state) => state.setSelectedCue);

  const [start, setStart] = React.useState(cue.start);
  const [end, setEnd] = React.useState(cue.end);
  const [text, setText] = React.useState(cue.text);

  const words = text.split(/\s+/).filter(Boolean);
  const warning = words.length > maxWordsPerLine;

  const applyChanges = () => {
    if (end <= start) {
      alert('End time must be after start time');
      return;
    }
    if (end - start < 0.3) {
      alert('Cue duration must be at least 0.3 seconds');
      return;
    }
    updateCue(index, { start, end, text });
  };

  const toggleLinked = () => {
    setLinked(index, !cue.linked);
  };

  return (
    <div
      data-cue-index={index}
      onClick={() => setSelectedCue(index)}
      className={`flex flex-col gap-1 p-2 rounded-md border ${warning ? 'border-amber-500/40 bg-amber-950/20' : 'border-gray-700'} ${cue.linked ? '' : 'opacity-60'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Cue {index + 1}</span>
        <button onClick={toggleLinked} className="text-xs text-gray-400 hover:text-gray-200" title="Toggle linked">
          {cue.linked ? '🔗' : '🚫'}
        </button>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <input type="number" step="0.01" value={start} onChange={(e) => setStart(parseFloat(e.target.value) || 0)} className="w-20 rounded bg-gray-800 text-white p-1" />
        <span>→</span>
        <input type="number" step="0.01" value={end} onChange={(e) => setEnd(parseFloat(e.target.value) || 0)} className="w-20 rounded bg-gray-800 text-white p-1" />
        <button onClick={applyChanges} className="ml-auto px-2 py-1 bg-blue-600 rounded text-xs hover:bg-blue-500">Apply</button>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} className="text-sm break-all bg-gray-900 text-white p-1 rounded" rows={2} />
      {warning && (
        <div className="flex items-center gap-1 text-amber-400 text-xs mt-1">
          <AlertTriangle size={14} />
          <span>{words.length} / {maxWordsPerLine} words</span>
        </div>
      )}
      <div className="flex gap-2 mt-1">
        <button onClick={() => deleteCue(index)} className="px-2 py-1 bg-red-600 rounded text-xs hover:bg-red-500">Delete</button>
        <button onClick={() => mergeCueWithNext(index)} className="px-2 py-1 bg-yellow-600 rounded text-xs hover:bg-yellow-500">Merge ↓</button>
        <button onClick={() => addCueAfter(index)} className="px-2 py-1 bg-green-600 rounded text-xs hover:bg-green-500">+ Add</button>
      </div>
    </div>
  );
}
