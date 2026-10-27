import test from 'node:test';
import assert from 'node:assert/strict';
import { clampCueMove, moveCueSet, resizeCueBounds, rescaleWordTimes, snapCueTime, syncCueWords } from './cueTiming.ts';

const cue = (start, end, linked = false) => ({ start, end, text: 'one two', linked, words: [{ text: 'one', start, end: start + (end - start) / 2 }, { text: 'two', start: start + (end - start) / 2, end }], manuallyEdited: false });

test('cue move clamp observes video bounds and adjacent cue edges', () => {
  const cues = [cue(1, 2), cue(2.5, 3.5), cue(4, 5)];
  assert.equal(clampCueMove(cues, 1, -5, 8), 2);
  assert.equal(clampCueMove(cues, 1, 7, 6), 3);
  assert.deepEqual(moveCueSet(cues, 1, -5, 8).map(({ start, end }) => [start, end]), [[1, 2], [2, 3], [4, 5]]);
});

test('resize clamp respects minimum duration, neighbours, and video end', () => {
  const cues = [cue(0, 1), cue(1.5, 2.5), cue(3, 4)];
  assert.equal(resizeCueBounds(cues, 1, 'start', 0, 5), 1);
  assert.equal(resizeCueBounds(cues, 1, 'end', 9, 5), 3);
  assert.equal(resizeCueBounds(cues, 1, 'end', 1.6, 5), 1.8);
});

test('snap uses playhead or 0.05-second grid, and Alt returns the raw time', () => {
  assert.equal(snapCueTime(1.08, [1], false), 1);
  assert.equal(snapCueTime(1.08, [], false), 1.1);
  assert.equal(snapCueTime(1.083, [1], true), 1.083);
});

test('resizes word timestamps proportionally across the new cue duration', () => {
  const words = rescaleWordTimes(cue(2, 4).words, 2, 4, 1, 5);
  assert.deepEqual(words?.map(({ start, end }) => [start, end]), [[1, 3], [3, 5]]);
});

test('text edits keep existing word times when the token count is unchanged', () => {
  const prior = [{ text: 'old', start: 1, end: 1.4 }, { text: 'words', start: 1.4, end: 2 }];
  assert.deepEqual(syncCueWords('new words', 1, 2, prior), [{ text: 'new', start: 1, end: 1.4 }, { text: 'words', start: 1.4, end: 2 }]);
});

test('text edits rebuild word timestamps across the cue when token count changes', () => {
  const rebuilt = syncCueWords('one two three four', 2, 4, [{ text: 'old', start: 2, end: 4 }]);
  assert.deepEqual(rebuilt.map(({ start, end }) => [Number(start.toFixed(3)), Number(end.toFixed(3))]), [[2, 2.5], [2.5, 3], [3, 3.5], [3.5, 4]]);
});

test('moving a cue shifts only that cue and its word times, even when linked', () => {
  const cues = [cue(0, 1, true), cue(1.2, 2), cue(2.2, 3, true)];
  const moved = moveCueSet(cues, 0, 0.1, 5);
  assert.deepEqual(moved.map(({ start, end }) => [Number(start.toFixed(3)), Number(end.toFixed(3))]), [[0.1, 1.1], [1.2, 2], [2.2, 3]]);
  assert.ok(Math.abs(moved[0].words?.[0].start - (cues[0].words[0].start + 0.1)) < 1e-9);
});
