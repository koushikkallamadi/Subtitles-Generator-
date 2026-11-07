import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTION_PRESETS, PREMIUM_PRESETS } from './captionPresets.ts';
import { DEFAULT_PREMIUM_CONFIG } from './captionStyle.ts';
import { chunkPremiumWords, paddedGlyphWidth, selectPremiumChunk, selectPremiumEmphasisIndex, shrinkPremiumTextScale, transformPremiumWord } from './premiumCaptions.ts';

const measure = (text, size) => text.length * size * .48;
const buildChunks = (text, width = 960, config = DEFAULT_PREMIUM_CONFIG) => chunkPremiumWords(text.split(/\s+/).filter(Boolean), config, width, 105.6, measure);

test('ships a single Premium color-editable preset, defaulting to the requested purple', () => {
  assert.deepEqual(PREMIUM_PRESETS.map((preset) => preset.name), ['Premium']);
  assert.equal(CAPTION_PRESETS.filter((preset) => preset.name === 'Premium').length, 1);
  assert.equal(PREMIUM_PRESETS[0].style.premium.accentColor, '#5638FF');
});

test('endukante phrase uses one support line and one emphasis word', () => {
  const chunk = buildChunks('endukante ee unit prices')[0];
  assert.deepEqual(chunk.words, ['endukante', 'ee', 'unit', 'prices']);
  assert.equal(chunk.emphasisIndex, 3);
  assert.deepEqual(chunk.words.filter((_, index) => index !== chunk.emphasisIndex), ['endukante', 'ee', 'unit']);
});

test('long Telugu-in-English word stays intact and shrinks to fit the 88% width', () => {
  const chunks = buildChunks('chepinchukondi.', 950);
  assert.equal(chunks.length, 1);
  assert.deepEqual(chunks[0].words, ['chepinchukondi.']);
  assert.ok(chunks[0].emphasisScale >= .55);
  assert.ok(measure('chepinchukondi.', 105.6 * 1.8 * chunks[0].emphasisScale) <= 950);
  assert.equal(shrinkPremiumTextScale(1400, 420), .55);
});

test('includes glyph overhang and symmetric horizontal padding in fit width', () => {
  const fontSize = 200;
  const measured = paddedGlyphWidth({ width: 520, actualBoundingBoxLeft: 270, actualBoundingBoxRight: 265 }, 'prices', fontSize);
  assert.equal(measured, 270 + 265 - 5 * 4 + 200);
  assert.ok(shrinkPremiumTextScale(measured, 600) < 1);
});

test('Premium sweep has a fixed 55 percent default and no speed setting', () => {
  assert.equal(DEFAULT_PREMIUM_CONFIG.lightSweep.position, 55);
  assert.equal('speed' in DEFAULT_PREMIUM_CONFIG.lightSweep, false);
});

test('chunks long mixed captions without wrapping or orphaning words across 20 samples', () => {
  const samples = [
    'endukante ee unit prices', 'chepinchukondi.', 'ఈ యాప్ captions ఇస్తుంది', 'install CPAL anukunte',
    'this subtitle app zooms captions automatically', 'namaskaram andariki welcome back', 'చాలా బాగా మాట్లాడారు', 'a very long keyword chepinchukondi prices',
    'one two three four five six seven eight', 'తెలుగు హిందీ Tamil English mix', 'subtitles audience creators language timing', 'ee video lo captions ela add cheyali',
    'caption line never breaks a word', 'words words words word', 'అనుకుందాం ఇప్పుడు మనం', 'prices unit cost endukante',
    'today we are building padalu', 'chepinchukondi chepinchukondi', 'Hindi Hinglish Tenglish Telugu', 'last word is emphasis',
  ];
  for (const text of samples) {
    const chunks = buildChunks(text);
    assert.equal(chunks.flatMap((chunk) => chunk.words).join(' '), text, `word sequence changed: ${text}`);
    assert.ok(chunks.every((chunk) => chunk.words.length <= 4));
    assert.ok(chunks.every((chunk) => chunk.words.length === 1 || chunk.words.filter((_, i) => i !== chunk.emphasisIndex).length <= 3));
    assert.ok(chunks.every((chunk) => chunk.supportScale >= .55 && chunk.emphasisScale >= .55));
    for (const chunk of chunks) {
      const support = chunk.words.filter((_, i) => i !== chunk.emphasisIndex).join(' ');
      if (support) assert.ok(measure(support.toLowerCase(), 105.6 * chunk.supportScale) <= 960);
    }
  }
});

test('selects emphasis by last, longest, or manual word and preserves Telugu case', () => {
  const words = ['install', 'CPAL', 'anukunte'];
  assert.equal(selectPremiumEmphasisIndex(words, DEFAULT_PREMIUM_CONFIG), 2);
  assert.equal(selectPremiumEmphasisIndex(words, { ...DEFAULT_PREMIUM_CONFIG, emphasisStrategy: 'longest' }), 2);
  assert.equal(selectPremiumEmphasisIndex(words, { ...DEFAULT_PREMIUM_CONFIG, emphasisStrategy: 'custom', emphasisWord: 'CPAL' }), 1);
  assert.equal(transformPremiumWord('తెలుగు', DEFAULT_PREMIUM_CONFIG), 'తెలుగు');
});

test('selects one complete measured chunk for the active word', () => {
  const chunks = buildChunks('this subtitle app zooms captions');
  const active = selectPremiumChunk(chunks, 3);
  assert.equal(active.wordOffset, 0);
  assert.deepEqual(active.words, ['this', 'subtitle', 'app', 'zooms']);
});
