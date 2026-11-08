from app.services.transcription.sarvam import SarvamProvider


def test_estimated_chunk_end_adds_chunk_offset_once():
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

    assert estimated is True
    assert len(words) == 2
    assert words[0].start == 10.0
    assert words[-1].end == 11.0
