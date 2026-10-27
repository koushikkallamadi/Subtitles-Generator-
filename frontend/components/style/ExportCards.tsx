import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Download, FileText, Film, LoaderCircle, Send, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useVideoStore } from '../../store/videoStore';
import { SectionHeading } from './PresetGrid';
import { backendUrl, cancelExportJob, fetchExportJob, startProjectExport, submitExportFeedback, type ExportJob, type ExportFeedback } from '../../lib/projects';
import { breakCaptionLines } from '../../lib/captionLines';
import { scaleToFontPixels } from '../../lib/captionStyle';

function stamp(seconds: number, separator: ',' | '.') {
  const total = Math.max(0, Math.round((seconds + useVideoStore.getState().timingOffset) * 1000));
  const hours = Math.floor(total / 3_600_000), minutes = Math.floor((total % 3_600_000) / 60_000), secs = Math.floor((total % 60_000) / 1000), millis = total % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}${separator}${String(millis).padStart(3, '0')}`;
}

function download(format: 'srt' | 'vtt') {
  const { cues, projectName, captionStyle, maxWordsPerLine, maxLinesPerSubtitle } = useVideoStore.getState();
  const lineWidth = 1920 * 0.85 / scaleToFontPixels(captionStyle.scale, 1080);
  const entries = cues.map((cue, index) => `${format === 'srt' ? `${index + 1}\n` : ''}${stamp(cue.start, format === 'srt' ? ',' : '.')} --> ${stamp(cue.end, format === 'srt' ? ',' : '.')}\n${breakCaptionLines(cue.text, lineWidth, maxWordsPerLine, maxLinesPerSubtitle).map((line) => line.join(' ')).join('\n')}`).join('\n\n');
  const content = format === 'vtt' ? `WEBVTT\n\n${entries}` : entries;
  const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  const base = (projectName || 'captions').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_');
  anchor.href = url; anchor.download = `${base}.${format}`; anchor.click(); URL.revokeObjectURL(url);
}

export default function ExportCards() {
  const projectId = useVideoStore((state) => state.projectId);
  const captionStyle = useVideoStore((state) => state.captionStyle);
  const timingOffset = useVideoStore((state) => state.timingOffset);
  const [exportJobs, setExportJobs] = useState<Record<string, ExportJob | null>>({});
  const [exportErrors, setExportErrors] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState<Record<string, number>>({});
  useEffect(() => { setExportJobs({}); setExportErrors({}); setStartedAt({}); }, [projectId]);
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
  </section>;
}

function ExportCard({ icon, title, badge, description, kind, job, error, busy, startedAt, onStart, onCancel, projectId }: { icon: React.ReactNode; title: string; badge: string; description: string; kind: 'video' | 'greenscreen'; job?: ExportJob | null; error?: string; busy: boolean; startedAt?: number; onStart: (kind: 'video' | 'greenscreen') => void; onCancel: (kind: 'video' | 'greenscreen', jobId: string) => void; projectId: string | null }) {
  const finished = job?.status === 'done';
  const elapsed = startedAt ? Date.now() - startedAt : 0;
  const preparingFonts = Boolean(job && (job.status === 'queued' || job.status === 'running') && elapsed >= 60_000 && (job.percent === 0 || job.percent === null));
  return <article className="rounded-2xl border border-gray-700/80 bg-[#202329] p-3.5"><div className="flex items-start gap-3"><span className="mt-0.5 shrink-0 text-gray-300">{icon}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{title}</h3><span className="shrink-0 rounded-full border border-gray-600 px-2.5 py-1 text-[10px] text-gray-300">{badge}</span></div><p className="mt-1 text-xs leading-relaxed text-gray-400">{description}</p>
    {job && (job.status === 'queued' || job.status === 'running') ? <div className="mt-3"><div className="flex items-center gap-1.5 text-[11px] text-gray-300"><LoaderCircle size={13} className="animate-spin" />{job.step}<span className="ml-auto tabular-nums">{job.indeterminate || job.percent === null ? 'Progress unavailable' : `${job.percent}%`}</span><button type="button" onClick={() => onCancel(kind, job.job_id)} className="ml-2 rounded-md border border-gray-600 px-2 py-1 text-[10px] text-gray-300 hover:border-red-400 hover:text-red-200">Cancel</button></div>{job.indeterminate || job.percent === null ? <p className="mt-2 text-[11px] text-gray-500">The source duration is unknown, so progress cannot be estimated.</p> : <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-700"><div className="h-full rounded-full bg-[#dc735c] transition-all" style={{ width: `${Math.max(0, Math.min(100, job.percent || 0))}%` }} /></div>}{preparingFonts && <p className="mt-2 text-[11px] text-amber-200">Preparing fonts, first export can take longer.</p>}</div> : finished ? <a href={`${backendUrl}/projects/${encodeURIComponent(projectId || '')}/export/${kind}/download`} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#dc735c] px-3 py-1.5 text-xs font-semibold text-[#241916] hover:bg-[#e88770]"><Download size={14} />Download .MP4</a> : <button type="button" disabled={busy} onClick={() => onStart(kind)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:border-[#dc735c] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"><Clock3 size={13} />{job?.status === 'error' ? 'Try again' : 'Export .MP4'}</button>}
    {(error || job?.error) && <p role="alert" className="mt-2 text-xs text-red-300">{error || job?.error}</p>}
    {finished && job?.job_id && projectId && <ExportFeedbackForm key={job.job_id} projectId={projectId} jobId={job.job_id} kind={kind} />}
  </div></div></article>;
}

function ExportFeedbackForm({ projectId, jobId, kind }: { projectId: string; jobId: string; kind: 'video' | 'greenscreen' }) {
  const [liked, setLiked] = useState<boolean | null>(null);
  const [rating, setRating] = useState(0);
  const [issueArea, setIssueArea] = useState<NonNullable<ExportFeedback['issue_area']> | ''>('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const needsDetails = liked === false;
  const canSubmit = liked !== null && rating > 0 && (!needsDetails || (Boolean(issueArea) && Boolean(comment.trim())));

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await submitExportFeedback(projectId, {
        export_job_id: jobId,
        kind,
        liked: liked!,
        rating,
        ...(issueArea ? { issue_area: issueArea } : {}),
        comment: comment.trim(),
      });
      setSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="mt-4 rounded-xl border border-gray-700/80 bg-[#191c22] p-3.5">
    {submitted ? <p role="status" className="flex items-center gap-2 text-sm font-medium text-emerald-300"><CheckCircle2 size={17} />Thanks. Your feedback was saved for this export.</p> : <>
      <h4 className="text-sm font-semibold text-gray-100">How did this export go?</h4>
      <p className="mt-1 text-xs leading-relaxed text-gray-400">Your feedback helps us improve caption quality and export reliability.</p>
      <fieldset className="mt-3">
        <legend className="text-xs font-medium text-gray-300">Did you like the result?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setLiked(true)} aria-pressed={liked === true} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs transition ${liked === true ? 'border-emerald-400/70 bg-emerald-400/10 text-emerald-200' : 'border-gray-700 text-gray-300 hover:border-gray-500'}`}><ThumbsUp size={14} />Yes, looks good</button>
          <button type="button" onClick={() => setLiked(false)} aria-pressed={liked === false} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs transition ${liked === false ? 'border-amber-400/70 bg-amber-400/10 text-amber-100' : 'border-gray-700 text-gray-300 hover:border-gray-500'}`}><ThumbsDown size={14} />Needs work</button>
        </div>
      </fieldset>
      <fieldset className="mt-3">
        <legend className="text-xs font-medium text-gray-300">Rate this export</legend>
        <div className="mt-1.5 flex gap-1">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} star${star === 1 ? '' : 's'}`} aria-pressed={rating === star} className="rounded p-1 text-gray-500 transition hover:text-amber-300"><Star size={21} fill={rating >= star ? 'currentColor' : 'none'} className={rating >= star ? 'text-amber-300' : ''} /></button>)}</div>
      </fieldset>
      {needsDetails && <label className="mt-3 block text-xs font-medium text-gray-300">What needs attention?
        <select value={issueArea} onChange={(event) => setIssueArea(event.target.value as typeof issueArea)} className="mt-1.5 w-full rounded-lg border border-gray-700 bg-[#22252b] px-2.5 py-2 text-xs text-gray-200 outline-none focus:border-gray-500">
          <option value="">Choose an area</option><option value="timing">Caption timing</option><option value="caption_text">Caption text</option><option value="appearance">Caption appearance</option><option value="audio_video">Audio or video quality</option><option value="download">Export or download</option><option value="other">Something else</option>
        </select>
      </label>}
      <label className="mt-3 block text-xs font-medium text-gray-300">{needsDetails ? 'What went wrong?' : 'Any suggestions?'}{needsDetails && <span className="ml-1 text-amber-300">Required</span>}
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={3} placeholder={needsDetails ? 'Describe the problem so we can investigate it.' : 'Tell us what worked well or what would make this better.'} className="mt-1.5 w-full resize-y rounded-lg border border-gray-700 bg-[#22252b] px-2.5 py-2 text-xs leading-relaxed text-gray-200 outline-none placeholder:text-gray-500 focus:border-gray-500" />
      </label>
      <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10px] text-gray-500">{comment.length}/2000</span><button type="button" disabled={!canSubmit || submitting} onClick={() => void submit()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#dc735c] px-3 py-2 text-xs font-semibold text-[#241916] transition hover:bg-[#e88770] disabled:cursor-not-allowed disabled:opacity-40">{submitting ? 'Sending…' : 'Send feedback'}<Send size={13} /></button></div>
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </>}
  </div>;
}
