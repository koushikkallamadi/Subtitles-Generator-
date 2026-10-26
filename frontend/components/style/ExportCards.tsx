import { useEffect, useState } from 'react';
import { Clock3, Download, FileText, Film, LoaderCircle, Star } from 'lucide-react';
import { useVideoStore } from '../../store/videoStore';
import { SectionHeading } from './PresetGrid';
import { backendUrl, cancelExportJob, fetchExportJob, startProjectExport, type ExportJob } from '../../lib/projects';

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
  const projectId = useVideoStore((state) => state.projectId);
  const captionStyle = useVideoStore((state) => state.captionStyle);
  const timingOffset = useVideoStore((state) => state.timingOffset);
  const [exportJobs, setExportJobs] = useState<Record<string, ExportJob | null>>({});
  const [exportErrors, setExportErrors] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState<Record<string, number>>({});
  const [rating, setRating] = useState(0);
  useEffect(() => { setRating(Number(localStorage.getItem(`captionkit-rating-${projectKey}`) || 0)); }, [projectKey]);
  useEffect(() => { setExportJobs({}); setExportErrors({}); setStartedAt({}); }, [projectId]);
  const saveRating = (value: number) => { setRating(value); localStorage.setItem(`captionkit-rating-${projectKey}`, String(value)); };
  const running = Object.values(exportJobs).some((job) => job && (job.status === 'queued' || job.status === 'running'));
  useEffect(() => {
    const active = Object.entries(exportJobs).filter(([, job]) => job?.job_id && (job.status === 'queued' || job.status === 'running')) as [string, ExportJob][];
    if (!active.length) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void Promise.all(active.map(async ([kind, job]) => {
        try {
          const start = startedAt[kind] || Date.now();
          if (Date.now() - start >= 15 * 60 * 1000) {
            await cancelExportJob(job.job_id).catch(() => undefined);
            if (!cancelled) {
              setExportErrors((current) => ({ ...current, [kind]: 'Export was stopped after 15 minutes without finishing.' }));
              setExportJobs((current) => ({ ...current, [kind]: { ...job, status: 'error', step: 'Timed out', error: 'Export was stopped after 15 minutes.' } }));
              setStartedAt((current) => { const next = { ...current }; delete next[kind]; return next; });
            }
            return;
          }
          const latest = await fetchExportJob(job.job_id);
          if (!cancelled) {
            setExportJobs((current) => ({ ...current, [kind]: latest }));
            if (latest.status === 'done' || latest.status === 'error') setStartedAt((current) => { const next = { ...current }; delete next[kind]; return next; });
          }
        } catch (error) {
          if (!cancelled) { setExportErrors((current) => ({ ...current, [kind]: error instanceof Error ? error.message : 'Could not read export status' })); setExportJobs((current) => ({ ...current, [kind]: { ...job, status: 'error', step: 'Export failed' } })); setStartedAt((current) => { const next = { ...current }; delete next[kind]; return next; }); }
        }
      }));
    }, 1500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [exportJobs, startedAt]);
  const runExport = async (kind: 'video' | 'greenscreen') => {
    if (!projectId) { setExportErrors((current) => ({ ...current, [kind]: 'Save or upload this video as a project before exporting.' })); return; }
    setExportErrors((current) => ({ ...current, [kind]: '' }));
    setStartedAt((current) => ({ ...current, [kind]: Date.now() }));
    setExportJobs((current) => ({ ...current, [kind]: { job_id: '', status: 'queued', step: 'Starting export', percent: 0 } }));
    try {
      const job = await startProjectExport(projectId, kind, captionStyle, timingOffset);
      setExportJobs((current) => ({ ...current, [kind]: job }));
    } catch (error) {
      setExportJobs((current) => ({ ...current, [kind]: null }));
      setStartedAt((current) => { const next = { ...current }; delete next[kind]; return next; });
      setExportErrors((current) => ({ ...current, [kind]: error instanceof Error ? error.message : 'Could not start export' }));
    }
  };
  const stopExport = async (kind: 'video' | 'greenscreen', jobId: string) => {
    setExportErrors((current) => ({ ...current, [kind]: '' }));
    try { await cancelExportJob(jobId); }
    catch (error) { setExportErrors((current) => ({ ...current, [kind]: error instanceof Error ? error.message : 'Could not cancel export' })); }
  };

  return <section className="space-y-3">
    <SectionHeading eyebrow="3. EXPORT" title="Exports" />
    <div className="space-y-2.5">
      <article className="rounded-2xl border border-gray-700/80 bg-[#202329] p-3.5">
        <div className="flex items-start gap-3"><FileText size={19} className="mt-0.5 shrink-0 text-gray-200" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">.SRT file</h3><span className="rounded-full border border-gray-600 px-2.5 py-1 text-[10px] text-gray-300">Fastest</span></div><p className="mt-1 text-xs leading-relaxed text-gray-400">Timed subtitle file you can import into Premiere, Resolve, Final Cut, or CapCut.</p><div className="mt-3 flex items-center gap-3"><button type="button" onClick={() => download('srt')} className="rounded-lg bg-[#dc735c] px-3 py-1.5 text-xs font-semibold text-[#241916] hover:bg-[#e88770]">Download .SRT</button><button type="button" onClick={() => download('vtt')} className="text-xs font-semibold text-gray-300 underline decoration-gray-600 underline-offset-4 hover:text-white">.VTT</button></div></div></div>
      </article>
      <ExportCard kind="greenscreen" icon={<Film size={19} />} title="Green-screen layer (.mp4)" badge="Fast" description="Captions on solid green. Import it into Premiere, Resolve, Final Cut, or CapCut and remove the green with chroma key." job={exportJobs.greenscreen} error={exportErrors.greenscreen} busy={running} startedAt={startedAt.greenscreen} onStart={runExport} onCancel={stopExport} projectId={projectId} />
      <ExportCard kind="video" icon={<Film size={19} />} title="Export complete video" badge="Slow" description="Captions are burned into your uploaded video so it is ready to share." job={exportJobs.video} error={exportErrors.video} busy={running} startedAt={startedAt.video} onStart={runExport} onCancel={stopExport} projectId={projectId} />
    </div>
    <div className="rounded-2xl border border-gray-700/70 bg-[#191c22] px-4 py-4 text-center">
      <h3 className="text-sm font-semibold">How were your subtitles?</h3><p className="mt-1 text-xs text-gray-500">A quick tap helps us improve.</p>
      <div className="mt-3 flex justify-center gap-2">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => saveRating(star)} aria-label={`${star} star${star > 1 ? 's' : ''}`} aria-pressed={rating === star} className="rounded p-1 text-gray-500 transition hover:scale-110 hover:text-amber-300"><Star size={24} fill={rating >= star ? 'currentColor' : 'none'} className={rating >= star ? 'text-amber-300' : ''} /></button>)}</div>
      {rating > 0 && <p className="mt-2 text-xs text-gray-400">Thanks for your feedback.</p>}
    </div>
  </section>;
}

function ExportCard({ icon, title, badge, description, kind, job, error, busy, startedAt, onStart, onCancel, projectId }: { icon: React.ReactNode; title: string; badge: string; description: string; kind: 'video' | 'greenscreen'; job?: ExportJob | null; error?: string; busy: boolean; startedAt?: number; onStart: (kind: 'video' | 'greenscreen') => void; onCancel: (kind: 'video' | 'greenscreen', jobId: string) => void; projectId: string | null }) {
  const finished = job?.status === 'done';
  const elapsed = startedAt ? Date.now() - startedAt : 0;
  const preparingFonts = Boolean(job && (job.status === 'queued' || job.status === 'running') && elapsed >= 60_000 && (job.percent === 0 || job.percent === null));
  return <article className="rounded-2xl border border-gray-700/80 bg-[#202329] p-3.5"><div className="flex items-start gap-3"><span className="mt-0.5 shrink-0 text-gray-300">{icon}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{title}</h3><span className="shrink-0 rounded-full border border-gray-600 px-2.5 py-1 text-[10px] text-gray-300">{badge}</span></div><p className="mt-1 text-xs leading-relaxed text-gray-400">{description}</p>
    {job && (job.status === 'queued' || job.status === 'running') ? <div className="mt-3"><div className="flex items-center gap-1.5 text-[11px] text-gray-300"><LoaderCircle size={13} className="animate-spin" />{job.step}<span className="ml-auto tabular-nums">{job.indeterminate || job.percent === null ? 'Progress unavailable' : `${job.percent}%`}</span><button type="button" onClick={() => onCancel(kind, job.job_id)} className="ml-2 rounded-md border border-gray-600 px-2 py-1 text-[10px] text-gray-300 hover:border-red-400 hover:text-red-200">Cancel</button></div>{job.indeterminate || job.percent === null ? <p className="mt-2 text-[11px] text-gray-500">The source duration is unknown, so progress cannot be estimated.</p> : <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-700"><div className="h-full rounded-full bg-[#dc735c] transition-all" style={{ width: `${Math.max(0, Math.min(100, job.percent || 0))}%` }} /></div>}{preparingFonts && <p className="mt-2 text-[11px] text-amber-200">Preparing fonts, first export can take longer.</p>}</div> : finished ? <a href={`${backendUrl}/projects/${encodeURIComponent(projectId || '')}/export/${kind}/download`} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#dc735c] px-3 py-1.5 text-xs font-semibold text-[#241916] hover:bg-[#e88770]"><Download size={14} />Download .MP4</a> : <button type="button" disabled={busy} onClick={() => onStart(kind)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:border-[#dc735c] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"><Clock3 size={13} />{job?.status === 'error' ? 'Try again' : 'Export .MP4'}</button>}
    {(error || job?.error) && <p role="alert" className="mt-2 text-xs text-red-300">{error || job?.error}</p>}</div></div></article>;
}
