/**
 * Greedily-balanced caption line breaking in approximate em units. The same
 * deterministic estimate is used by the live preview and text exports.
 */
export function breakCaptionLines(
  input: string[] | string,
  boxWidth: number,
  maxWordsPerLine = 4,
  maxLines = 2,
): string[][] {
  const words = (Array.isArray(input) ? input : input.split(/\s+/)).map((word) => word.trim()).filter(Boolean);
  if (!words.length) return [];
  const width = Math.max(1, Number.isFinite(boxWidth) ? boxWidth : 1);
  const wordLimit = Math.max(1, Math.floor(Number.isFinite(maxWordsPerLine) ? maxWordsPerLine : 4));
  const lineLimit = Math.max(1, Math.floor(Number.isFinite(maxLines) ? maxLines : 2));
  const measure = (line: string[]) => line.reduce((sum, word) => sum + Math.max(0.55, Array.from(word).length * 0.55), 0) + Math.max(0, line.length - 1) * 0.3;
  const visibleLength = (word: string) => Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word.replace(/[.,!?;:'"()[\]{}…।॥\-_]/g, ''))).length;
  const isOrphan = (line: string[]) => line.length === 1 && visibleLength(line[0]) <= 2;
  const candidates: string[][][] = [];
  const search = (from: number, lines: string[][]) => {
    if (from === words.length) {
      if (lines.length <= lineLimit && !lines.some(isOrphan)) candidates.push(lines);
      return;
    }
    if (lines.length === lineLimit) return;
    for (let count = 1; count <= wordLimit && from + count <= words.length; count++) {
      const line = words.slice(from, from + count);
      // A single long token is allowed to overflow; splitting words is never desirable.
      if (count > 1 && measure(line) > width) break;
      search(from + count, [...lines, line]);
    }
  };
  search(0, []);
  if (!candidates.length) {
    // Preserve every word within limits when a pathological cue cannot satisfy
    // the orphan rule or the width estimate; merge the tail into its previous line.
    const fallback: string[][] = [];
    for (let i = 0; i < words.length; i += wordLimit) fallback.push(words.slice(i, i + wordLimit));
    if (fallback.length > lineLimit) {
      const head = fallback.slice(0, lineLimit - 1);
      head.push(fallback.slice(lineLimit - 1).flat());
      return head;
    }
    if (fallback.length > 1 && isOrphan(fallback[fallback.length - 1])) fallback[fallback.length - 2].push(...fallback.pop()!);
    return fallback;
  }
  const target = candidates.reduce((best, lines) => Math.min(best, lines.reduce((sum, line) => sum + measure(line), 0) / lines.length), Infinity);
  return candidates.sort((a, b) => {
    const score = (lines: string[][]) => {
      const widths = lines.map(measure), mean = widths.reduce((sum, value) => sum + value, 0) / widths.length;
      return Math.abs(mean - target) + widths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, widths.length);
    };
    return score(a) - score(b) || a.length - b.length;
  })[0];
}
