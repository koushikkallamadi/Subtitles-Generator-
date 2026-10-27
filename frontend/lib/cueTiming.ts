import type { Cue, WordTimestamp } from '../store/videoStore';

export function syncCueWords(text: string, start: number, end: number, existing?: WordTimestamp[]): WordTimestamp[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  if (existing?.length === tokens.length) return tokens.map((token, index) => ({ ...existing[index], text: token }));
  const span = Math.max(0, end - start);
  return tokens.map((token, index) => ({ text: token, start: start + span * index / tokens.length, end: start + span * (index + 1) / tokens.length }));
}

export function snapCueTime(value: number, snapPoints: number[] = [], disableSnap = false, step = 0.05, threshold = 0.12): number {
  if (!Number.isFinite(value)) return 0;
  if (disableSnap) return value;
  const nearby = snapPoints.filter(Number.isFinite).reduce<number | null>((best, point) =>
    Math.abs(point - value) <= threshold && (best === null || Math.abs(point - value) < Math.abs(best - value)) ? point : best, null);
  const snapped = nearby ?? Math.round(value / step) * step;
  return Math.round(snapped * 1000) / 1000;
}

export function clampCueMove(cues: Cue[], index: number, proposedStart: number, duration: number): number {
  const cue = cues[index];
  if (!cue) return 0;
  const cueDuration = cue.end - cue.start;
  const minStart = Math.max(0, cues[index - 1]?.end ?? 0);
  const maxStart = Math.min(Math.max(0, duration - cueDuration), cues[index + 1]?.start === undefined ? Infinity : cues[index + 1].start - cueDuration);
  return Math.min(maxStart, Math.max(minStart, proposedStart));
}

export function resizeCueBounds(cues: Cue[], index: number, edge: 'start' | 'end', proposedTime: number, duration: number, minDuration = 0.3): number {
  const cue = cues[index];
  if (!cue) return 0;
  if (edge === 'start') return Math.max(cues[index - 1]?.end ?? 0, Math.min(cue.end - minDuration, Math.max(0, proposedTime)));
  return Math.min(duration, Math.max(cue.start + minDuration, Math.min(cues[index + 1]?.start ?? duration, proposedTime)));
}

export function rescaleWordTimes(words: WordTimestamp[] | undefined, oldStart: number, oldEnd: number, newStart: number, newEnd: number): WordTimestamp[] | undefined {
  if (!words?.length) return words;
  const oldSpan = Math.max(0.001, oldEnd - oldStart), newSpan = Math.max(0, newEnd - newStart);
  return words.map((word) => ({
    ...word,
    start: newStart + Math.max(0, Math.min(1, (word.start - oldStart) / oldSpan)) * newSpan,
    end: newStart + Math.max(0, Math.min(1, (word.end - oldStart) / oldSpan)) * newSpan,
  }));
}

export function moveCueSet(cues: Cue[], index: number, delta: number, duration: number): Cue[] {
  const cue = cues[index];
  if (!cue) return cues;
  const appliedDelta = clampCueMove(cues, index, cue.start + delta, duration) - cue.start;
  return cues.map((item, i) => i === index ? ({
    ...item, start: item.start + appliedDelta, end: item.end + appliedDelta,
    words: item.words?.map((word) => ({ ...word, start: word.start + appliedDelta, end: word.end + appliedDelta })),
    manuallyEdited: true,
  }) : item);
}

export function resizeCueSet(cues: Cue[], index: number, edge: 'start' | 'end', value: number, duration: number): Cue[] {
  const cue = cues[index];
  if (!cue) return cues;
  const nextBound = resizeCueBounds(cues, index, edge, value, duration);
  const start = edge === 'start' ? nextBound : cue.start;
  const end = edge === 'end' ? nextBound : cue.end;
  return cues.map((item, i) => i === index ? ({ ...item, start, end, words: rescaleWordTimes(item.words, cue.start, cue.end, start, end), manuallyEdited: true }) : item);
}

export function shiftCuesAfter(cues: Cue[], index: number, seconds: number, duration: number): Cue[] {
  if (!Number.isFinite(seconds)) return cues;
  const later = cues.slice(index + 1);
  if (!later.length) return cues;
  const delta = Math.min(duration - later[later.length - 1].end, Math.max((cues[index]?.end ?? 0) - later[0].start, seconds));
  return cues.map((cue, i) => i > index ? ({
    ...cue, start: cue.start + delta, end: cue.end + delta,
    words: cue.words?.map((word) => ({ ...word, start: word.start + delta, end: word.end + delta })), manuallyEdited: true,
  }) : cue);
}
