import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STYLE, positionToPixels, scaleToFontPixels, validateCaptionStyle } from './captionStyle.ts';
import { CAPTION_PRESETS, detectCaptionPreset } from './captionPresets.ts';

test('style validation clamps numeric values and rejects invalid animation', () => {
  const style = validateCaptionStyle({ ...DEFAULT_STYLE, scale: 999, position: { x: -4, y: 130 }, animation: 'bogus', stroke: { ...DEFAULT_STYLE.stroke, widthPx: 33 } });
  assert.equal(style.scale, 250);
  assert.deepEqual(style.position, { x: 0, y: 100 });
  assert.equal(style.animation, 'none');
  assert.equal(style.stroke.widthPx, 12);
});

test('preset detection uses the complete style config', () => {
  assert.equal(detectCaptionPreset(CAPTION_PRESETS.find((preset) => preset.name === 'Duo').style), 'Duo');
  const altered = validateCaptionStyle({ ...CAPTION_PRESETS[0].style, scale: 101 });
  assert.equal(detectCaptionPreset(altered), 'Custom');
});

test('position and scale conversions use frame-relative units', () => {
  assert.deepEqual(positionToPixels({ x: 50, y: 86 }, { width: 1920, height: 1080 }), { x: 960, y: 928.8 });
  assert.equal(scaleToFontPixels(100, 1080), 48.6);
  assert.equal(scaleToFontPixels(100, 540), 24.3);
});
