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
settings_module.settings = types.SimpleNamespace(EXPORT_DIR=str(BACKEND_ROOT / "test-data" / "exports"), TEMP_DIR=str(BACKEND_ROOT / "test-data" / "tmp"), FONT_DIR=str(BACKEND_ROOT / "fonts"), EXPORT_MAX_HEIGHT=0, EXPORT_PRESET="ultrafast", EXPORT_CRF=18)
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


class PremiumExportTests(unittest.TestCase):
    def test_premium_export_uses_stacked_text_glow_and_premium_geometry(self):
        style = {
            "premium": {
                "enabled": True,
                "accentColor": "#5B6CFF",
                "glowColor": "#4055F5",
                "glowBlur": [6, 18, 40, 80],
                "glowIntensity": 1,
                "neonLayers": 4,
                "fontFamily": "Poppins",
                "fontSizeBase": 5.5,
                "ratioScale": 1.8,
                "maxWidthPercent": 88,
                "positionY": 65,
                "quality": 2,
                "dropShadow": {"enabled": True, "x": 0, "y": 2, "blur": 8, "color": "#000000", "opacity": 60},
                "wordsPerChunk": {"max": 4},
                "caseTransform": "lowercase",
                "fontWeight": {"support": 600, "emphasis": 800},
                "emphasisStrategy": "last",
                "inDuration": 120,
                "outDuration": 80,
                "zIndex": {"glow": 0, "fill": 1},
            }
        }
        cues = [{
            "start": 0,
            "end": 2,
            "text": "this subtitle app zooms captions all done automatically",
            "words": [
                {"text": token, "start": index * .25, "end": (index + 1) * .25}
                for index, token in enumerate("this subtitle app zooms captions all done automatically".split())
            ],
        }]

        ass = export.build_ass(cues, style, 1080, 1920)

        self.assertIn("PlayResX: 2160", ass)
        self.assertIn("PlayResY: 3840", ass)
        self.assertIn(r"\N", ass)
        self.assertIn(r"\fs380.16", ass)
        self.assertIn(r"\blur", ass)
        sweep_lines = [line for line in ass.splitlines() if line.startswith("Dialogue: 2,")]
        self.assertTrue(sweep_lines)
        self.assertTrue(all(r"\clip(1,m " in line for line in sweep_lines))
        self.assertTrue(all(r"\t(" not in line for line in sweep_lines))
        self.assertIn("automatically", ass)
        self.assertNotIn("BorderStyle=3", ass)

    def test_ass_premium_keeps_endukante_phrase_to_two_unwrapped_lines(self):
        style = {"premium": {
            "enabled": True, "accentColor": "#5638FF", "glowColor": "#5B8CFF",
            "gradientEnabled": False, "accentGradient": ["#1F4BFF", "#3FA0FF"],
            "glowExposure": .3, "glowRadius": 1, "fontFamily": "Poppins", "fontSizeBase": 5.5,
            "ratioScale": 1.8, "maxWidthPercent": 88, "positionY": 67, "quality": 2,
            "wordsPerChunk": {"max": 4}, "emphasisStrategy": "last", "caseTransform": "lowercase",
            "fontWeight": {"support": 600, "emphasis": 800}, "inDuration": 120, "outDuration": 80,
        }}
        phrase = "endukante ee unit prices"
        cue = {"start": 0, "end": 1.2, "text": phrase, "words": [
            {"text": word, "start": index * .3, "end": (index + 1) * .3}
            for index, word in enumerate(phrase.split())
        ]}

        ass = export.build_ass([cue], style, 1080, 1920)

        self.assertIn(r"\q2", ass)
        self.assertIn(r"endukante ee unit\N{", ass)
        self.assertIn("}prices", ass)
        self.assertNotIn("chepinchukond\\Ni", ass)


if __name__ == "__main__":
    unittest.main()
