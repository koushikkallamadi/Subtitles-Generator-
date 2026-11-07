import type { PremiumCaptionConfig } from './captionStyle';

export type PremiumChunk = {
  words: string[];
  wordOffset: number;
  emphasisIndex: number;
  supportScale: number;
  emphasisScale: number;
};
export type PremiumMeasure = (text: string, fontSize: number, fontWeight: number) => number;

export function paddedGlyphWidth(metrics: { width: number; actualBoundingBoxLeft?: number; actualBoundingBoxRight?: number }, text: string, fontSize: number): number {
  const letterSpacing = Math.max(0, text.length - 1) * fontSize * -.02;
  const advanceWidth = Math.max(0, metrics.width + letterSpacing);
  const glyphWidth = Math.max(0, (metrics.actualBoundingBoxLeft ?? metrics.width / 2) + (metrics.actualBoundingBoxRight ?? metrics.width / 2) + letterSpacing);
  return Math.max(advanceWidth, glyphWidth) + fontSize;
}

const normalized = (word: string) => word.toLocaleLowerCase().replace(/^[.,!?;:'"()[\]{}\-_/&+%#$@]+|[.,!?;:'"()[\]{}\-_/&+%#$@]+$/g, '');

export function selectPremiumEmphasisIndex(words: string[], config: PremiumCaptionConfig): number {
  if (!words.length) return -1;
  if (config.emphasisStrategy === 'custom' && config.emphasisWord.trim()) {
    const target = normalized(config.emphasisWord);
    for (let index = words.length - 1; index >= 0; index--) if (normalized(words[index]) === target) return index;
  }
  if (config.emphasisStrategy === 'longest') {
    return words.reduce((best, word, index) => normalized(word).length > normalized(words[best]).length ? index : best, 0);
  }
  return words.length - 1;
}

/** Applies casing only to tokens made entirely of Latin letters, numbers and punctuation. */
export function transformPremiumWord(word: string, config: PremiumCaptionConfig): string {
  const override = config.uppercaseOverride.some((value) => normalized(value) === normalized(word));
  if (!/^[A-Za-z\u00C0-\u024F0-9\s.,!?;:'"()[\]{}\-_/&+%#$@]+$/.test(word)) return word;
  if (override) return word.toLocaleUpperCase();
  if (config.caseTransform === 'uppercase') return word.toLocaleUpperCase();
  if (config.caseTransform === 'lowercase') return word.toLocaleLowerCase();
  return word;
}

/** Shrink in two-percent increments, stopping at 55%; callers clip only after that limit. */
export function shrinkPremiumTextScale(measuredWidth: number, availableWidth: number): number {
  if (!Number.isFinite(measuredWidth) || measuredWidth <= 0 || !Number.isFinite(availableWidth) || availableWidth <= 0) return 1;
  for (let scale = 1; scale >= .55; scale = Math.round((scale - .02) * 100) / 100) {
    if (measuredWidth * scale <= availableWidth) return scale;
  }
  return .55;
}

/**
 * Builds stable two-line caption chunks from actual frame-width measurements.
 * The emphasized word is chosen first; no line can wrap or split a word.
 */
export function chunkPremiumWords(
  words: string[],
  config: PremiumCaptionConfig,
  availableWidth: number,
  supportFontSize: number,
  measureText: PremiumMeasure,
): PremiumChunk[] {
  if (!words.length) return [];
  const maximum = Math.max(1, Math.min(4, Math.floor(config.wordsPerChunk.max) || 4));
  const chunks: PremiumChunk[] = [];
  let offset = 0;
  while (offset < words.length) {
    const remaining = words.length - offset;
    const maxCandidate = Math.min(maximum, remaining);
    let selected: PremiumChunk | undefined;
    for (let size = maxCandidate; size >= 2; size--) {
      const candidate = words.slice(offset, offset + size);
      const emphasisIndex = selectPremiumEmphasisIndex(candidate, config);
      const supportText = candidate
        .filter((_, index) => index !== emphasisIndex)
        .map((word) => transformPremiumWord(word, config))
        .join(' ');
      const supportWidth = measureText(supportText, supportFontSize, config.fontWeight.support);
      const supportScale = shrinkPremiumTextScale(supportWidth, availableWidth);
      if (supportWidth * supportScale <= availableWidth + .01) {
        const emphasis = transformPremiumWord(candidate[emphasisIndex], config);
        const emphasisWidth = measureText(emphasis, supportFontSize * config.ratioScale, config.fontWeight.emphasis);
        selected = {
          words: candidate,
          wordOffset: offset,
          emphasisIndex,
          supportScale,
          emphasisScale: shrinkPremiumTextScale(emphasisWidth, availableWidth),
        };
        break;
      }
    }
    if (!selected) {
      const word = words[offset];
      const emphasisWidth = measureText(transformPremiumWord(word, config), supportFontSize * config.ratioScale, config.fontWeight.emphasis);
      selected = {
        words: [word], wordOffset: offset, emphasisIndex: 0, supportScale: 1,
        emphasisScale: shrinkPremiumTextScale(emphasisWidth, availableWidth),
      };
    }
    chunks.push(selected);
    offset += selected.words.length;
  }
  return chunks;
}

export function selectPremiumChunk(chunks: PremiumChunk[], activeWordIndex: number): PremiumChunk {
  if (!chunks.length) return { words: [], wordOffset: 0, emphasisIndex: -1, supportScale: 1, emphasisScale: 1 };
  return chunks.find((chunk) => activeWordIndex >= chunk.wordOffset && activeWordIndex < chunk.wordOffset + chunk.words.length) || chunks[0];
}
