import re
from typing import List, Dict, Any
from app.services.transcription.base import WordTimestamp, Segment, TranscriptionResult

PUNCTUATION_SPLITS = {".", "!", "?", "।", "\n"}
SOFT_PUNCTUATION = {",", ";", ":", "-"}

def segment_words_into_cues(
    words: List[WordTimestamp],
    max_words_per_cue: int = 5,
    max_chars_per_cue: int = 38,
    max_pause_sec: float = 0.7,
    max_duration_sec: float = 3.5,
) -> List[Dict[str, Any]]:
    """
    Groups word-level timestamps into subtitle cues.
    Returns list of dicts: [{"start": float, "end": float, "text": str}]
    """
    if not words:
        return []

    cues: List[Dict[str, Any]] = []
    current_words: List[WordTimestamp] = []

    def flush_cue():
        nonlocal current_words
        if not current_words:
            return
        cue_text = " ".join(w.text for w in current_words).strip()
        if cue_text:
            start = round(current_words[0].start, 2)
            end = round(max(current_words[-1].end, start + 0.5), 2)
            cues.append({
                "start": start,
                "end": end,
                "text": cue_text,
            })
        current_words = []

    for i, word in enumerate(words):
        if not current_words:
            current_words.append(word)
            continue

        prev_word = current_words[-1]
        pause = word.start - prev_word.end
        current_cue_duration = word.end - current_words[0].start
        current_char_count = sum(len(w.text) for w in current_words) + len(current_words) - 1

        # Check conditions for starting a new cue
        ends_with_sentence_punct = any(prev_word.text.endswith(p) for p in PUNCTUATION_SPLITS)
        ends_with_soft_punct = any(prev_word.text.endswith(p) for p in SOFT_PUNCTUATION)
        has_significant_pause = pause >= max_pause_sec
        exceeds_max_words = len(current_words) >= max_words_per_cue
        exceeds_max_chars = current_char_count + len(word.text) + 1 > max_chars_per_cue
        exceeds_duration = current_cue_duration >= max_duration_sec

        if ends_with_sentence_punct or has_significant_pause:
            flush_cue()
            current_words.append(word)
        elif (ends_with_soft_punct and len(current_words) >= 3) or exceeds_max_words or exceeds_max_chars or exceeds_duration:
            flush_cue()
            current_words.append(word)
        else:
            current_words.append(word)

    flush_cue()
    return cues

def cues_from_transcription(result: TranscriptionResult) -> List[Dict[str, Any]]:
    """Convert a TranscriptionResult into subtitle cues."""
    if result.words:
        return segment_words_into_cues(result.words)
    elif result.segments:
        cues = []
        for s in result.segments:
            if s.text.strip():
                cues.append({
                    "start": round(s.start, 2),
                    "end": round(s.end, 2),
                    "text": s.text.strip(),
                })
        return cues
    elif result.text.strip():
        # Fallback if no words or segments
        return [{
            "start": 0.0,
            "end": 5.0,
            "text": result.text.strip(),
        }]
    return []
