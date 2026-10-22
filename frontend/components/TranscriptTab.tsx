import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Captions, ChevronDown, ChevronUp, Languages, List, RotateCcw } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import CueCard from './CueCard';
import { useVideoStore } from '../store/videoStore';
import StyleExportTab from './style/StyleExportTab';

const languages = ['English', 'Hindi', 'Telugu', 'Tamil', 'Marathi', 'Urdu', 'Kannada', 'Bengali', 'Malayalam', 'Gujarati'];
const headerClass = 'flex w-full items-center justify-between border-b border-[#dc735c]/25 bg-[#322421] px-3 py-3 text-left text-sm font-semibold text-[#dc735c]';

export default function TranscriptTab({ onRegenerate }: { onRegenerate?: () => void }) {
  const store = useVideoStore();
  const { cues } = store;
  const [activeTab, setActiveTab] = useState<'transcript' | 'style'>('transcript');
  const [showSettings, setShowSettings] = useState(true), [showCues, setShowCues] = useState(true);
  const [toast, setToast] = useState('');
  const [playhead, setPlayhead] = useState(-1);
  const cueList = useRef<HTMLDivElement>(null);
  const initial = useRef({ cues: JSON.stringify(store.originalCues), offset: 0, maxWords: 4, maxLines: 2 });
  const changed = useMemo(() => JSON.stringify(cues) !== initial.current.cues || store.timingOffset !== initial.current.offset || store.maxWordsPerLine !== initial.current.maxWords || store.maxLinesPerSubtitle !== initial.current.maxLines, [cues, store.timingOffset, store.maxWordsPerLine, store.maxLinesPerSubtitle, store.originalCues]);
  useEffect(() => { initial.current = { cues: JSON.stringify(store.originalCues), offset: 0, maxWords: 4, maxLines: 2 }; }, [store.originalCues]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const video = document.querySelector('video');
      if (video && !video.paused) {
        const time = video.currentTime - store.timingOffset;
        const index = store.cues.findIndex((cue) => time >= cue.start && time <= cue.end);
        setPlayhead(index);
        if (index >= 0) {
          const card = cueList.current?.querySelector(`[data-cue-index="${index}"]`);
          card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      } else setPlayhead(-1);
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [store.cues, store.timingOffset]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(''), 2600); return () => clearTimeout(timeout); }, [toast]);
  const resegment = (maxWords: number, lines: number) => {
    if (store.cues.some((cue) => cue.manuallyEdited) && !window.confirm('Re-segmenting replaces your manual cue edits. Continue?')) return;
    store.resegmentCues(maxWords, lines);
  };
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden text-white">
    <div className="sticky top-0 z-20 grid shrink-0 grid-cols-2 border-b border-gray-700/80 bg-[#1a1e2b]">
      <button onClick={() => setActiveTab('transcript')} className={`flex items-center justify-center gap-2 border-b-2 px-2 py-3 text-sm font-semibold ${activeTab === 'transcript' ? 'border-[#dc735c] text-[#dc735c]' : 'border-transparent text-gray-400 hover:text-white'}`}><List size={16} />Transcript</button>
      <button onClick={() => setActiveTab('style')} className={`flex items-center justify-center gap-2 border-b-2 px-2 py-3 text-sm font-medium ${activeTab === 'style' ? 'border-[#dc735c] text-[#dc735c]' : 'border-transparent text-gray-400 hover:text-white'}`}><Captions size={16} />Style &amp; export</button>
    </div>
    <div className="sticky top-[46px] z-20 flex shrink-0 items-center justify-end gap-2 border-b border-gray-800 bg-[#1a1e2b] px-3 py-2">
      <button disabled={!changed} onClick={() => { store.resetCues(); initial.current = { cues: JSON.stringify(store.originalCues), offset: 0, maxWords: 4, maxLines: 2 }; }} className="flex items-center gap-1 rounded-lg bg-[#282a30] px-2.5 py-1.5 text-xs text-[#dc735c] hover:bg-[#343137] disabled:cursor-default disabled:opacity-35"><RotateCcw size={13} />Reset</button>
      <button onClick={onRegenerate} className="rounded-lg border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 hover:border-gray-500 hover:text-white">Regenerate</button>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {activeTab === 'style' ? <StyleExportTab /> : <>
      <section>
        <button onClick={() => setShowSettings(!showSettings)} className={headerClass}><span>Transcript settings</span>{showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
        {showSettings && <SettingsPanel onResegment={resegment} />}
      </section>
      <section>
        <button onClick={() => setShowCues(!showCues)} className={headerClass}><span>Cues ({cues.length})</span>{showCues ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
        {showCues && <>
          <div className="border-b border-gray-800 px-3 py-3"><div className="relative"><Languages size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><select defaultValue="" onChange={(event) => { if (event.target.value) setToast('Translation coming soon'); event.target.value = ''; }} className="w-full appearance-none rounded-full border border-gray-700 bg-[#22252b] py-2.5 pl-9 pr-9 text-sm text-gray-300 outline-none focus:border-gray-500"><option value="">Translate to</option>{languages.map((language) => <option key={language}>{language}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /></div></div>
          <div ref={cueList} className="flex flex-col gap-3 p-3">{cues.map((cue, index) => <CueCard key={`${index}-${cue.start}`} cue={cue} index={index} current={index === playhead} />)}</div>
        </>}
      </section>
      </>}
    </div>
    {toast && <div role="status" className="fixed bottom-5 right-5 z-50 rounded-xl border border-gray-600 bg-[#25282f] px-4 py-3 text-sm shadow-xl">{toast}</div>}
  </div>;
}
