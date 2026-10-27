"""Word timing helpers shared by hybrid transcription and alignment diagnostics."""
from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher
from typing import Sequence

from app.services.transcription.base import WordTimestamp


def normalize_roman(text: str) -> str:
    """Lowercase Roman tokens only; native-script tokens cannot be fuzzy matched."""
    normalized = unicodedata.normalize("NFKD", text).casefold()
    return re.sub(r"[^a-z0-9]", "", normalized)


def similarity(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    return SequenceMatcher(None, left, right).ratio()


def monotonic_fuzzy_matches(
    source: Sequence[WordTimestamp], reference: Sequence[WordTimestamp], threshold: float = 0.60,
) -> list[tuple[int, int, float]]:
    """Maximum-similarity, order-preserving word alignment.

    A dynamic-programming alignment tolerates recognition insertions/deletions
    without allowing later words to match before earlier ones.
    """
    source_tokens = [normalize_roman(word.text) for word in source]
    reference_tokens = [normalize_roman(word.text) for word in reference]
    rows, columns = len(source_tokens), len(reference_tokens)
    score = [[0.0] * (columns + 1) for _ in range(rows + 1)]
    steps = [["skip_source"] * (columns + 1) for _ in range(rows + 1)]
    for source_index in range(1, rows + 1):
        for reference_index in range(1, columns + 1):
            best = score[source_index - 1][reference_index]
            step = "skip_source"
            if score[source_index][reference_index - 1] > best:
                best = score[source_index][reference_index - 1]
                step = "skip_reference"
            value = similarity(source_tokens[source_index - 1], reference_tokens[reference_index - 1])
            if value >= threshold and score[source_index - 1][reference_index - 1] + value > best:
                best = score[source_index - 1][reference_index - 1] + value
                step = "match"
            score[source_index][reference_index] = best
            steps[source_index][reference_index] = step

    matches: list[tuple[int, int, float]] = []
    source_index, reference_index = rows, columns
    while source_index and reference_index:
        step = steps[source_index][reference_index]
        if step == "match":
            value = similarity(source_tokens[source_index - 1], reference_tokens[reference_index - 1])
            matches.append((source_index - 1, reference_index - 1, value))
            source_index -= 1
            reference_index -= 1
        elif step == "skip_source":
            source_index -= 1
        else:
            reference_index -= 1
    matches.reverse()
    return matches


def word_weight(word: str) -> int:
    vowels = re.findall(r"[aeiouy]+", word.casefold())
    return max(1, len(vowels)) if re.search(r"[a-z]", word.casefold()) else max(1, len(word))


def smooth_words(words: Sequence[WordTimestamp], minimum_duration: float = 0.060) -> list[WordTimestamp]:
    """Enforce increasing, non-zero word spans without moving a match backwards."""
    output: list[WordTimestamp] = []
    previous_end = 0.0
    for word in words:
        start = max(previous_end, float(word.start))
        end = max(start + minimum_duration, float(word.end))
        output.append(WordTimestamp(text=word.text, start=round(start, 4), end=round(end, 4), confidence=word.confidence))
        previous_end = end
    return output


def merge_whisper_timings(
    source: Sequence[WordTimestamp], reference: Sequence[WordTimestamp], threshold: float = 0.60,
    source_matching_words: Sequence[WordTimestamp] | None = None,
    reference_matching_words: Sequence[WordTimestamp] | None = None,
) -> tuple[list[WordTimestamp], float]:
    """Use matched reference times and interpolate unmatched words between them."""
    matches = monotonic_fuzzy_matches(
        source_matching_words or source,
        reference_matching_words or reference,
        threshold,
    )
    if not source or len(matches) / len(source) < 0.40:
        return list(source), len(matches) / len(source) if source else 0.0

    known = {source_index: reference[reference_index] for source_index, reference_index, _ in matches}
    result: list[WordTimestamp] = []
    for index, word in enumerate(source):
        reference_word = known.get(index)
        if reference_word:
            result.append(WordTimestamp(text=word.text, start=reference_word.start, end=reference_word.end, confidence=word.confidence))
            continue
        before = max((matched for matched in known if matched < index), default=None)
        after = min((matched for matched in known if matched > index), default=None)
        left = known[before].end if before is not None else word.start
        right = known[after].start if after is not None else word.end
        indexes = list(range((before + 1) if before is not None else index, (after if after is not None else index + 1)))
        weights = [word_weight(source[item].text) for item in indexes]
        offset = indexes.index(index)
        total = sum(weights)
        start = left + (right - left) * sum(weights[:offset]) / total
        end = left + (right - left) * sum(weights[:offset + 1]) / total
        result.append(WordTimestamp(text=word.text, start=start, end=max(start + 0.060, end), confidence=word.confidence))
    return smooth_words(result), len(matches) / len(source)
