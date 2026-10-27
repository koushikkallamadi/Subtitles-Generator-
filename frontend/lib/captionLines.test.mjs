import test from 'node:test';
import assert from 'node:assert/strict';
import { breakCaptionLines } from './captionLines.ts';

const hasOrphan = (lines) => lines.some((line) => line.length === 1 && Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(line[0].replace(/[.,!?;:'"()[\]{}…।॥\-_]/g, ''))).length < 3);

test('keeps a tiny punctuation-attached tail on the preceding line', () => {
  const lines = breakCaptionLines(['perugutay', 'i.'], 20, 4, 2);
  assert.deepEqual(lines, [['perugutay', 'i.']]);
  assert.equal(hasOrphan(lines), false);
});

test('keeps a single long word intact', () => {
  const lines = breakCaptionLines(['supercalifragilisticexpialidocious'], 3, 4, 2);
  assert.deepEqual(lines, [['supercalifragilisticexpialidocious']]);
  assert.equal(hasOrphan(lines), false);
});

test('balances six short words into two lines', () => {
  const lines = breakCaptionLines(['la', 'la', 'la', 'la', 'la', 'la'], 5, 4, 2);
  assert.equal(lines.length, 2);
  assert.equal(lines.flat().length, 6);
  assert.equal(hasOrphan(lines), false);
  assert.ok(Math.abs(lines[0].length - lines[1].length) <= 1);
});

test('supports Telugu and does not leave a one-token tail', () => {
  const lines = breakCaptionLines(['తెలుగు', 'పదాలు', 'చక్కగా', 'ఉంటాయి', 'ఇవి'], 10, 4, 2);
  assert.equal(lines.flat().length, 5);
  assert.equal(hasOrphan(lines), false);
});

test('never exceeds the configured words per line when a full cue fits', () => {
  const lines = breakCaptionLines(['one', 'two', 'three', 'four', 'five', 'six'], 2, 3, 2);
  assert.ok(lines.every((line) => line.length <= 3));
  assert.equal(hasOrphan(lines), false);
});
