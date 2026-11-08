import unittest
import sys

# test_export stubs media helpers for its isolated export tests. Remove that
# stub before importing the transcription services during unittest discovery.
media_stub = sys.modules.get("app.services.media")
if media_stub is not None and not hasattr(media_stub, "get_media_duration"):
    sys.modules.pop("app.services.media", None)
    services_package = sys.modules.get("app.services")
    if services_package is not None and hasattr(services_package, "media"):
        delattr(services_package, "media")

from app.services.segmentation import clamp_cues_to_duration
from app.services.transcription.sarvam import SarvamProvider


class TranscriptionTimingTests(unittest.TestCase):
    def test_estimated_chunk_end_adds_chunk_offset_once(self):
        provider = SarvamProvider()
        words, estimated = provider._parse_timestamps(
            timestamps_data={
                "words": ["solar panel"],
                "start_time_seconds": [0.0],
                # Sarvam can omit the end array for chunk-level timestamps.
            },
            raw_words=None,
            transcript="solar panel",
            time_offset=10.0,
            duration=1.0,
        )

        self.assertTrue(estimated)
        self.assertEqual(len(words), 2)
        self.assertEqual(words[0].start, 10.0)
        self.assertEqual(words[-1].end, 11.0)

    def test_cues_and_word_times_are_clamped_and_cues_have_minimum_duration(self):
        cues = clamp_cues_to_duration(
            [
                {"start": -0.2, "end": 0.05, "words": [{"text": "early", "start": -1, "end": 0.04}]},
                {"start": 4.95, "end": 8.0, "words": [{"text": "late", "start": 4.9, "end": 7.0}]},
                {"start": 5.0, "end": 5.2, "words": [{"text": "past", "start": 5.1, "end": 5.2}]},
                {"start": 2.0, "end": 2.5, "words": [{"text": "inside", "start": 2.4, "end": 3.0}]},
            ],
            duration=5.0,
        )

        self.assertEqual(len(cues), 3)
        self.assertEqual((cues[0]["start"], cues[0]["end"]), (0.0, 0.1))
        self.assertEqual((cues[0]["words"][0]["start"], cues[0]["words"][0]["end"]), (0.0, 0.04))
        self.assertEqual((cues[1]["start"], cues[1]["end"]), (4.9, 5.0))
        self.assertEqual((cues[1]["words"][0]["start"], cues[1]["words"][0]["end"]), (4.9, 5.0))
        self.assertEqual((cues[2]["words"][0]["start"], cues[2]["words"][0]["end"]), (2.4, 2.5))
        for cue in cues:
            self.assertGreaterEqual(cue["start"], 0.0)
            self.assertLessEqual(cue["end"], 5.0)
            self.assertGreaterEqual(round(cue["end"] - cue["start"], 6), 0.1)


if __name__ == "__main__":
    unittest.main()
