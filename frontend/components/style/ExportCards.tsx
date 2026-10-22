import { useEffect, useState } from 'react';
import { Clock3, FileText, Film, Star } from 'lucide-react';
import { useVideoStore } from '../../store/videoStore';
import { SectionHeading } from './PresetGrid';

function stamp(seconds: number, separator: ',' | '.') {
  const total = Math.max(0, Math.round((seconds + useVideoStore.getState().timingOffset) * 1000));
  const hours = Math.floor(total / 3_600_000), minutes = Math.floor((total % 3_600_000) / 60_000), secs = Math.floor((total % 60_000) / 1000), millis = total % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}${separator}${String(millis).padStart(3, '0')}`;
}

function download(format: 'srt' | 'vtt') {
  const { cues, projectName } = useVideoStore.getState();
  const entries = cues.map((cue, index) => `${format === 'srt' ? `${index + 1}\n` : ''}${stamp(cue.start, format === 'srt' ? ',' : '.')} --> ${stamp(cue.end, format === 'srt' ? ',' : '.')}\n${cue.text}`).join('\n\n');
  const content = format === 'vtt' ? `WEBVTT\n\n${entries}` : entries;
  const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  const base = (projectName || 'captions').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_');
  anchor.href = url; anchor.download = `${base}.${format}`; anchor.click(); URL.revokeObjectURL(url);
}

export default function ExportCards() {
  const projectKey = useVideoStore((state) => state.projectId || state.projectName || 'default');
  const [rating, setRating] = useState(0);
  useEffect(() => { setRating(Number(localStorage.getItem(`captionkit-rating-${projectKey}`) || 0)); }, [projectKey]);
  const saveRating = (value: number) => { setRating(value); localStorage.setItem(`captionkit-rating-${projectKey}`, String(value)); };

  return <section className="space-y-3">
    <SectionHeading eyebrow="3. EXPORT" title="Exports" />
    <div className="space-y-2.5">
      <article className="rounded-2xl border border-gray-700/80 bg-[#202329] p-3.5">
        <div className="flex items-start gap-3"><FileText size={19} className="mt-0.5 shrink-0 text-gray-200" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">.SRT file</h3><span className="rounded-full border border-gray-600 px-2.5 py-1 text-[10px] text-gray-300">Fastest</span></div><p className="mt-1 text-xs leading-relaxed text-gray-400">Timed subtitle file you can import into Premiere, Resolve, Final Cut, or CapCut.</p><div className="mt-3 flex items-center gap-3"><button type="button" onClick={() => download('srt')} className="rounded-lg bg-[#dc735c] px-3 py-1.5 text-xs font-semibold text-[#241916] hover:bg-[#e88770]">Download .SRT</button><button type="button" onClick={() => download('vtt')} className="text-xs font-semibold text-gray-300 underline decoration-gray-600 underline-offset-4 hover:text-white">.VTT</button></div></div></div>
      </article>
      <ExportCard icon={<Film size={19} />} title="Green-screen layer (.mp4)" badge="Fast" description="Captions on solid green. Import it into Premiere, Resolve, Final Cut, or CapCut and remove the green with chroma key." />
      <ExportCard icon={<Film size={19} />} title="Export complete video" badge="Slow" description="Captions are burned into your uploaded video so it is ready to share." />
    </div>
    <div className="rounded-2xl border border-gray-700/70 bg-[#191c22] px-4 py-4 text-center">
      <h3 className="text-sm font-semibold">How were your subtitles?</h3><p className="mt-1 text-xs text-gray-500">A quick tap helps us improve.</p>
      <div className="mt-3 flex justify-center gap-2">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => saveRating(star)} aria-label={`${star} star${star > 1 ? 's' : ''}`} aria-pressed={rating === star} className="rounded p-1 text-gray-500 transition hover:scale-110 hover:text-amber-300"><Star size={24} fill={rating >= star ? 'currentColor' : 'none'} className={rating >= star ? 'text-amber-300' : ''} /></button>)}</div>
      {rating > 0 && <p className="mt-2 text-xs text-gray-400">Thanks for your feedback.</p>}
    </div>
  </section>;
}

function ExportCard({ icon, title, badge, description }: { icon: React.ReactNode; title: string; badge: string; description: string }) {
  return <article aria-disabled="true" className="rounded-2xl border border-gray-700/80 bg-[#202329] p-3.5 opacity-70"><div className="flex items-start gap-3"><span className="mt-0.5 shrink-0 text-gray-300">{icon}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{title}</h3><span className="shrink-0 rounded-full border border-gray-600 px-2.5 py-1 text-[10px] text-gray-300">{badge}</span></div><p className="mt-1 text-xs leading-relaxed text-gray-400">{description}</p><div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500"><Clock3 size={12} />Coming soon</div></div></div></article>;
}
