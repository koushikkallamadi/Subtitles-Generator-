import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

# Export probing does not need application configuration or media binaries.
# Stub those imports so these unit tests never load backend/.env.
settings_module = types.ModuleType("app.core.settings")
settings_module.settings = object()
sys.modules.setdefault("app.core.settings", settings_module)
media_module = types.ModuleType("app.services.media")
media_module.get_ffmpeg_cmd = lambda: "ffmpeg"
media_module.get_ffprobe_cmd = lambda: "ffprobe"
sys.modules.setdefault("app.services.media", media_module)

from app.services import export


class ProbeVideoTests(unittest.TestCase):
    def test_audio_only_source_uses_safe_canvas_and_container_duration(self):
        probe_result = types.SimpleNamespace(
            stdout=json.dumps({"streams": [], "format": {"duration": "12.5"}})
        )
        with patch.object(export.subprocess, "run", return_value=probe_result):
            metadata = export.probe_video(Path("voiceover.wav"))

        self.assertEqual(metadata, {
            "width": 1920,
            "height": 1080,
            "fps": "30/1",
            "duration": 12.5,
            "has_video": False,
        })

    def test_video_source_keeps_its_dimensions_and_frame_rate(self):
        probe_result = types.SimpleNamespace(stdout=json.dumps({
            "streams": [{"width": 1280, "height": 720, "avg_frame_rate": "25/1", "duration": "8"}],
            "format": {"duration": "8"},
        }))
        with patch.object(export.subprocess, "run", return_value=probe_result):
            metadata = export.probe_video(Path("clip.mp4"))

        self.assertEqual(metadata, {
            "width": 1280,
            "height": 720,
            "fps": "25/1",
            "duration": 8.0,
            "has_video": True,
        })


if __name__ == "__main__":
    unittest.main()
