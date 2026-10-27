"""ASS subtitle generation and asynchronous ffmpeg export jobs."""
from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import threading
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape as xml_escape

from app.core.settings import settings
from app.services.media import get_ffmpeg_cmd, get_ffprobe_cmd

logger = logging.getLogger(__name__)
STORAGE_ROOT = Path(__file__).resolve().parents[2] / "storage"
FONTS_DIR = Path(__file__).resolve().parents[2] / "fonts"
FONTS_USED = ["System", "TikTok Sans", "Anton", "Archivo Black", "Inter", "Oswald", "League Spartan", "Baloo 2", "Poppins", "Montserrat", "Bebas Neue", "Bangers", "Lora", "Caveat", "Noto Sans", "Noto Sans Telugu", "Noto Sans Devanagari", "Noto Sans Tamil"]
jobs: dict[str, dict[str, Any]] = {}
_jobs_lock = threading.Lock()
subtitles_available = False
_job_controls: dict[str, dict[str, Any]] = {}
_job_lock = threading.RLock()
_warmup_thread: threading.Thread | None = None
_warmup_done = threading.Event()
_warmup_done.set()
font_warmup_status = "not_started"


def check_subtitles_filter() -> bool:
    global subtitles_available
    try:
        result = subprocess.run([get_ffmpeg_cmd(), "-hide_banner", "-filters"], capture_output=True, text=True, timeout=15)
        subtitles_available = result.returncode == 0 and re.search(r"\bsubtitles\b", result.stdout) is not None
    except Exception as exc:
        logger.error("Could not inspect ffmpeg filters: %s", exc)
        subtitles_available = False
    found = []
    missing = []
    if FONTS_DIR.exists():
        available_files = [path.name.lower() for path in FONTS_DIR.rglob("*") if path.is_file()]
        for font in FONTS_USED:
            token = font.lower().replace(" ", "")
            (found if any(token in item.replace(" ", "") for item in available_files) else missing).append(font)
    else:
        missing = list(FONTS_USED)
    logger.warning("Bundled export fonts found in backend/fonts: %s", ", ".join(found) or "none")
    logger.warning("Frontend fonts missing from backend/fonts: %s", ", ".join(missing) or "none")
    if not subtitles_available:
        logger.error("FFmpeg subtitles filter/libass is unavailable. Install an FFmpeg build with libass (Windows: winget install -e --id Gyan.FFmpeg) and restart the backend.")
    return subtitles_available


def configure_fontconfig() -> Path:
    """Use a project-local fontconfig cache so a Windows system cache build is not shared/blocked."""
    root = STORAGE_ROOT / ".fontconfig"
    cache = root / "cache"
    root.mkdir(parents=True, exist_ok=True)
    cache.mkdir(parents=True, exist_ok=True)
    dirs = [FONTS_DIR.resolve().as_posix()]
    windows_fonts = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"
    if windows_fonts.is_dir():
        dirs.append(windows_fonts.resolve().as_posix())
    config = ["<?xml version=\"1.0\"?>", "<!DOCTYPE fontconfig SYSTEM \"fonts.dtd\">", "<fontconfig>"]
    config.extend(f"  <dir>{xml_escape(font_dir)}</dir>" for font_dir in dirs)
    config.append(f"  <cachedir>{xml_escape(cache.resolve().as_posix())}</cachedir>")
    config.append("</fontconfig>")
    config_path = root / "fonts.conf"
    config_path.write_text("\n".join(config) + "\n", encoding="utf-8")
    os.environ["FONTCONFIG_PATH"] = str(root.resolve())
    os.environ["FONTCONFIG_FILE"] = str(config_path.resolve())
    return root


def _warmup_fontconfig() -> None:
    global font_warmup_status
    root = configure_fontconfig()
    ass_path = root / "warmup.ass"
    output_log = root / "warmup.log"
    ass_path.write_text(
        "[Script Info]\nScriptType: v4.00+\nPlayResX: 64\nPlayResY: 64\n"
        "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        "Style: Default,Arial,12,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,1,0,0,2,0,0,0,1\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        "Dialogue: 0,0:00:00.00,0:00:00.10,Default,,0,0,0,,Warm-up\n",
        encoding="utf-8",
    )
    command = [get_ffmpeg_cmd(), "-hide_banner", "-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=0.1", "-vf", f"subtitles=filename={_filter_path(ass_path)}:fontsdir={_filter_path(FONTS_DIR)}", "-frames:v", "1", "-f", "null", "-"]
    try:
        with output_log.open("w", encoding="utf-8", errors="replace") as log:
            log.write("COMMAND: " + subprocess.list2cmdline(command) + "\n")
            log.flush()
            result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace", timeout=240, env=os.environ.copy())
            log.write("--- stdout ---\n" + result.stdout + "\n--- stderr ---\n" + result.stderr + "\n")
            log.write(f"EXIT CODE: {result.returncode}\n")
        if result.returncode:
            raise RuntimeError(f"font warm-up returned {result.returncode}; see {output_log}")
        font_warmup_status = "done"
        logger.warning("libass font warm-up completed; log: %s", output_log)
    except Exception as exc:
        font_warmup_status = "error"
        with output_log.open("a", encoding="utf-8", errors="replace") as log:
            log.write(f"WARM-UP ERROR: {exc}\n")
        logger.exception("libass font warm-up failed; exports will still attempt to render")
    finally:
        _warmup_done.set()


def start_font_warmup() -> None:
    global _warmup_thread, font_warmup_status
    configure_fontconfig()
    if not subtitles_available:
        font_warmup_status = "skipped_no_subtitles_filter"
        _warmup_done.set()
        return
    if _warmup_thread and _warmup_thread.is_alive():
        return
    _warmup_done.clear()
    font_warmup_status = "running"
    _warmup_thread = threading.Thread(target=_warmup_fontconfig, name="captionkit-font-warmup", daemon=True)
    _warmup_thread.start()


def _num(value: Any, fallback: float) -> float:
    try:
        number = float(value)
        return number if number == number and abs(number) != float("inf") else fallback
    except (TypeError, ValueError):
        return fallback


def _hex_color(value: Any, fallback: str = "#ffffff") -> str:
    return value if isinstance(value, str) and re.fullmatch(r"#[\da-fA-F]{6}", value) else fallback


def ass_color(value: str, opacity: float = 100) -> str:
    raw = _hex_color(value)[1:]
    r, g, b = raw[0:2], raw[2:4], raw[4:6]
    alpha = round((100 - max(0, min(100, opacity))) * 255 / 100)
    return f"&H{alpha:02X}{b.upper()}{g.upper()}{r.upper()}"


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}").replace("\n", r"\N")


def _time(seconds: float) -> str:
    centiseconds = max(0, round(seconds * 100))
    hours, rem = divmod(centiseconds, 360000)
    minutes, rem = divmod(rem, 6000)
    secs, cs = divmod(rem, 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{cs:02d}"


def _font_fallback(font: str, text: str) -> str:
    if re.search(r"[\u0c00-\u0c7f]", text):
        return "Noto Sans Telugu"
    if re.search(r"[\u0900-\u097f]", text):
        return "Noto Sans Devanagari"
    if re.search(r"[\u0b80-\u0bff]", text):
        return "Noto Sans Tamil"
    return font or "Arial"


def _font_size(style: dict[str, Any], height: int) -> float:
    return max(1, height * .045 * max(40, min(250, _num(style.get("scale"), 100))) / 100)


def build_ass(cues: list[dict[str, Any]], style: dict[str, Any], width: int, height: int, timing_offset: float = 0) -> str:
    position = style.get("position") or {}
    x = max(0, min(100, _num(position.get("x"), 50))) * width / 100
    y = max(0, min(100, _num(position.get("y"), 86))) * height / 100
    font = str(style.get("fontFamily") or "Arial")
    bold, italic = bool(style.get("bold", True)), bool(style.get("italic", False))
    stroke = style.get("stroke") or {}
    outline = max(0, min(12, _num(stroke.get("widthPx"), 3))) * height / 1080 if stroke.get("enabled") else 0
    background = style.get("background") or {}
    highlight = style.get("highlight") or {}
    back_opacity = _num(background.get("opacity"), 0) if background.get("enabled") else 0
    # ASS BorderStyle=3 is a rectangular opaque box; alpha is preserved in BackColour.
    border_style = 3 if background.get("enabled") else 1
    bg_padding = max(0, min(40, _num(background.get("paddingPx"), 0))) * height / 1080
    out_color = ass_color(stroke.get("color", "#111111"))
    if background.get("enabled"):
        out_color = ass_color(background.get("color", "#111111"), back_opacity)
    primary = ass_color(style.get("textColor", "#ffffff"))
    secondary = ass_color(highlight.get("textColor", "#171717"))
    back = ass_color(background.get("color", "#111111"), back_opacity)
    font_size = _font_size(style, height)
    # CaptionOverlay anchors its left/top at x/y then translates by (-50%, -100%),
    # so the ASS anchor is bottom-center at the same percent coordinates.
    align = "\\an2\\pos({:.0f},{:.0f})".format(x, y)
    animation = str(style.get("animation", "none"))
    header = (
        "[Script Info]\nScriptType: v4.00+\n" f"PlayResX: {width}\nPlayResY: {height}\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{font},{font_size:.2f},{primary},{secondary},{out_color},{back},{-1 if bold else 0},{-1 if italic else 0},{border_style},{max(outline, bg_padding):.2f},0,2,0,0,0,1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    events: list[str] = []
    for cue in cues:
        cue_start = max(0, _num(cue.get("start"), 0) + timing_offset)
        cue_end = max(cue_start + .03, _num(cue.get("end"), cue_start + .3) + timing_offset)
        raw_text = str(cue.get("text") or "")
        words = cue.get("words_json") or cue.get("words") or []
        if not isinstance(words, list):
            words = []
        # Keep editor line breaks when stored. Map word tokens for timing-driven rendering.
        tokens = [str(word.get("text", "")) for word in words if isinstance(word, dict) and str(word.get("text", "")).strip()]
        if not tokens:
            tokens = [word for word in re.split(r"\s+", raw_text.strip()) if word]
            span = cue_end - cue_start
            words = [{"text": token, "start": cue_start - timing_offset + span * i / len(tokens), "end": cue_start - timing_offset + span * (i + 1) / len(tokens)} for i, token in enumerate(tokens)] if tokens else []
        # Prefer the editor's explicit line breaks, otherwise join in word order.
        cue_text = _escape(raw_text) if "\n" in raw_text else _escape(" ".join(tokens))
        cue_font = _font_fallback(font, raw_text)
        tags = [align, f"\\fn{cue_font}"]
        if stroke.get("enabled"):
            tags.append(f"\\bord{outline:.2f}\\3c{ass_color(stroke.get('color', '#111111'))}")
        else:
            tags.append("\\bord0")
        if background.get("enabled"):
            tags.extend([f"\\3c{back}&", "\\bord{:.2f}".format(max(1, bg_padding)), "\\shad0"])
        if animation == "fade":
            tags.append("\\fad(180,120)")
        elif animation == "slideUp":
            tags.append(f"\\move({x:.0f},{y + height * .035:.0f},{x:.0f},{y:.0f},0,250)")
        elif animation in ("zoomIn", "popIn"):
            amount = 90 if animation == "zoomIn" else 75
            duration = 240 if animation == "zoomIn" else 200
            tags.append(f"\\fscx{amount}\\fscy{amount}\\t(0,{duration},\\fscx100\\fscy100)")
        words_data = []
        for word in words:
            if not isinstance(word, dict):
                continue
            start = max(cue_start, _num(word.get("start"), cue_start - timing_offset) + timing_offset)
            end = min(cue_end, _num(word.get("end"), start - timing_offset + .1) + timing_offset)
            if end <= start:
                end = min(cue_end, start + .01)
            words_data.append((str(word.get("text", "")), start, end))
        # Each event represents one state so word boundaries are exact at video-frame precision.
        boundaries = {cue_start, cue_end}
        if highlight.get("enabled") or style.get("reveal", {}).get("enabled") or animation == "typewriter":
            for _, start, end in words_data:
                boundaries.add(max(cue_start, min(cue_end, start)))
                if highlight.get("enabled"):
                    boundaries.add(max(cue_start, min(cue_end, end)))
        if animation == "typewriter":
            for step in range(1, min(160, max(1, len(raw_text)))):
                boundaries.add(cue_start + (cue_end - cue_start) * step / max(1, len(raw_text)))
        points = sorted(boundaries)
        for segment_start, segment_end in zip(points, points[1:]):
            if segment_end <= segment_start:
                continue
            active = next((i for i, (_, start, end) in enumerate(words_data) if start <= segment_start < end), -1)
            latest = max((i for i, (_, start, _) in enumerate(words_data) if start <= segment_start), default=-1)
            if style.get("reveal", {}).get("enabled") and latest < 0:
                continue
            if animation == "typewriter":
                elapsed = max(0, min(1, (segment_start - cue_start) / max(.001, cue_end - cue_start)))
                visible = raw_text[:max(1, round(len(raw_text) * elapsed))]
                pieces = []
                cursor = 0
                for token_match in re.finditer(r"\S+", visible):
                    pieces.append(_escape(visible[cursor:token_match.start()]))
                    token = token_match.group(0)
                    word_index = len(re.findall(r"\S+", visible[:token_match.start()]))
                    alternate = style.get("alternateFontFamily") if word_index % 2 else None
                    word_font = _font_fallback(str(alternate or font), token)
                    pieces.append("{\\fn" + word_font + "}")
                    if word_index == active and highlight.get("enabled"):
                        box_alpha = ass_color(highlight.get("boxColor", "#f5d95d"), _num(highlight.get("boxOpacity"), 100))
                        pieces.append("{\\1c" + ass_color(highlight.get("textColor", "#171717")) + "&\\bord" + f"{max(outline, 2):.2f}" + "\\3c" + box_alpha + "&}"
                                      + _escape(token) + "{\\1c" + primary + "&\\bord" + f"{outline:.2f}" + "\\3c" + out_color + "&}")
                    else:
                        pieces.append(_escape(token))
                    cursor = token_match.end()
                pieces.append(_escape(visible[cursor:]))
                text_value = "".join(pieces)
            elif style.get("reveal", {}).get("enabled") and "\n" not in raw_text:
                shown = " ".join(token for token, _, _ in words_data[:latest + 1])
                text_value = _escape(shown)
            elif "\n" not in raw_text:
                # ASS overrides use explicit word colors; other tokens retain primary color.
                text_parts = []
                for i, (token, _, _) in enumerate(words_data):
                    if i:
                        text_parts.append(" ")
                    alternate = style.get("alternateFontFamily") if i % 2 else None
                    word_font = _font_fallback(str(alternate or font), token)
                    if alternate or word_font != cue_font:
                        text_parts.append("{\\fn" + word_font + "}")
                    if i == active and highlight.get("enabled"):
                        box_alpha = ass_color(highlight.get("boxColor", "#f5d95d"), _num(highlight.get("boxOpacity"), 100))
                        text_parts.append("{\\1c" + ass_color(highlight.get("textColor", "#171717")) + "&\\bord" + f"{max(outline, 2):.2f}" + "\\3c" + box_alpha + "&}"
                                          + _escape(token) + "{\\1c" + primary + "&\\bord" + f"{outline:.2f}" + "\\3c" + out_color + "&}")
                    else:
                        text_parts.append(_escape(token))
                    if alternate or word_font != cue_font:
                        text_parts.append("{\\fn" + cue_font + "}")
                text_value = "".join(text_parts)
            else:
                text_value = cue_text
            events.append(f"Dialogue: 0,{_time(segment_start)},{_time(segment_end)},Default,,0,0,0,,{{{''.join(tags)}}}{text_value}")
    return header + "\n".join(events) + "\n"


def probe_video(path: Path) -> dict[str, Any]:
    result = subprocess.run([get_ffprobe_cmd(), "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,avg_frame_rate,r_frame_rate,duration:format=duration", "-of", "json", str(path)], capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)
    streams = data.get("streams") or []
    format_duration = _num(data.get("format", {}).get("duration"), 0)
    if not streams:
        # Audio-only media has no video stream to index. The green-screen
        # export uses these dimensions, and the full-video export uses them
        # for its black caption canvas.
        return {"width": 1920, "height": 1080, "fps": "30/1", "duration": format_duration if format_duration > 0 else None, "has_video": False}
    stream = streams[0]
    duration = _num(stream.get("duration"), format_duration)
    fps = stream.get("avg_frame_rate") or stream.get("r_frame_rate") or "30/1"
    if fps in ("0/0", "0/1"):
        fps = stream.get("r_frame_rate") or "30/1"
    return {"width": int(stream["width"]), "height": int(stream["height"]), "fps": fps, "duration": duration if duration > 0 else None, "has_video": True}


def _filter_path(path: Path) -> str:
    # libavfilter accepts single-quoted values; escape Windows drive colon for its option parser.
    value = path.resolve().as_posix().replace("'", "\\'").replace(":", r"\:")
    return "'" + value + "'"


class ExportFailure(RuntimeError):
    pass


def _run_ffmpeg(job_id: str, kind: str, source: Path, output: Path, ass_path: Path, metadata: dict[str, Any], log_path: Path, deadline: float, set_progress) -> None:
    fonts_arg = f":fontsdir={_filter_path(FONTS_DIR)}"
    vf = f"subtitles=filename={_filter_path(ass_path)}{fonts_arg}"
    if kind == "video":
        if metadata.get("has_video", True):
            command = [get_ffmpeg_cmd(), "-hide_banner", "-y", "-i", str(source), "-vf", vf, "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", "-progress", "pipe:1", "-nostats", str(output)]
        else:
            duration = metadata.get("duration")
            if not duration:
                raise ExportFailure("Audio duration is unknown; cannot create the caption video")
            command = [get_ffmpeg_cmd(), "-hide_banner", "-y", "-f", "lavfi", "-i", f"color=c=black:s={metadata['width']}x{metadata['height']}:r={metadata['fps']}:d={duration:.6f}", "-i", str(source), "-vf", vf, "-t", f"{duration:.6f}", "-map", "0:v:0", "-map", "1:a?", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-progress", "pipe:1", "-nostats", str(output)]
    else:
        duration = metadata["duration"]
        if not duration:
            raise ExportFailure("Video duration is unknown; cannot create the green-screen export source")
        command = [get_ffmpeg_cmd(), "-hide_banner", "-y", "-f", "lavfi", "-i", f"color=c=0x00FF00:s={metadata['width']}x{metadata['height']}:r={metadata['fps']}:d={duration:.6f}", "-vf", vf, "-t", f"{duration:.6f}", "-an", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-progress", "pipe:1", "-nostats", str(output)]

    control = _job_controls[job_id]
    stderr_tail: deque[str] = deque(maxlen=15)
    stderr_lock = threading.Lock()
    progress_lock = threading.Lock()
    latest_progress = [0.0, time.monotonic()]
    log_lock = threading.Lock()
    with log_path.open("a", encoding="utf-8", errors="replace") as log:
        log.write(f"\nCOMMAND: {subprocess.list2cmdline(command)}\n")
        log.write(f"STARTED: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        log.flush()

        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace", bufsize=1, env=os.environ.copy())
        control["process"] = process
        control["render_started"] = True

        def write_log(channel: str, line: str) -> None:
            with log_lock:
                log.write(f"[{channel}] {line}")
                if not line.endswith("\n"):
                    log.write("\n")
                log.flush()

        def read_stdout() -> None:
            assert process.stdout is not None
            for raw_line in iter(process.stdout.readline, ""):
                line = raw_line.strip()
                write_log("stdout", raw_line.rstrip("\r\n"))
                if not line.startswith(("out_time_us=", "out_time_ms=")):
                    continue
                try:
                    seconds = int(line.split("=", 1)[1]) / 1_000_000
                except ValueError:
                    continue
                now = time.monotonic()
                with progress_lock:
                    if seconds > latest_progress[0] + .001:
                        latest_progress[:] = [seconds, now]
                duration = metadata.get("duration")
                if duration and duration > 0:
                    percent = min(99, max(0, round(seconds / duration * 100)))
                    set_progress(percent, False)
                else:
                    set_progress(None, True)

        def read_stderr() -> None:
            assert process.stderr is not None
            for raw_line in iter(process.stderr.readline, ""):
                with stderr_lock:
                    stderr_tail.append(raw_line.rstrip("\r\n"))
                write_log("stderr", raw_line.rstrip("\r\n"))

        stdout_reader = threading.Thread(target=read_stdout, name=f"export-stdout-{job_id}", daemon=True)
        stderr_reader = threading.Thread(target=read_stderr, name=f"export-stderr-{job_id}", daemon=True)
        stdout_reader.start()
        stderr_reader.start()
        start_time = time.monotonic()
        last_reported_progress = 0.0
        try:
            while process.poll() is None:
                now = time.monotonic()
                if control["cancel"].is_set():
                    process.kill()
                    raise ExportFailure("Export cancelled by the user")
                if now >= deadline:
                    process.kill()
                    raise ExportFailure("Export exceeded the maximum runtime and was stopped")
                with progress_lock:
                    media_time, last_change = latest_progress
                if now - last_change >= 90:
                    process.kill()
                    raise ExportFailure("FFmpeg made no output progress for 90 seconds; the export was stopped")
                if media_time > last_reported_progress:
                    last_reported_progress = media_time
                time.sleep(.35)
        finally:
            if process.poll() is None:
                process.kill()
            process.wait()
            stdout_reader.join(timeout=10)
            stderr_reader.join(timeout=10)
            control["process"] = None
        elapsed = time.monotonic() - start_time
        with stderr_lock:
            tail = list(stderr_tail)
        write_log("meta", f"EXIT CODE: {process.returncode}; ELAPSED: {elapsed:.3f}s")
        if process.returncode:
            excerpt = "\n".join(tail) if tail else "(FFmpeg stderr was empty)"
            raise ExportFailure(f"FFmpeg exited with code {process.returncode}. Last 15 stderr lines:\n{excerpt}")
        if not output.is_file() or output.stat().st_size <= 0:
            raise ExportFailure("FFmpeg exited successfully but the export file is missing or empty")


def start_job(project_id: str, kind: str, source: Path, cues: list[dict[str, Any]], style: dict[str, Any], offset: float) -> tuple[str, bool]:
    with _jobs_lock:
        for existing_id, job in jobs.items():
            if job.get("project_id") == project_id and job.get("kind") == kind and job.get("status") in {"queued", "running"}:
                return existing_id, True
        job_id = str(uuid.uuid4())
        jobs[job_id] = {"id": job_id, "project_id": project_id, "kind": kind, "status": "queued", "step": "Queued", "percent": 0, "indeterminate": False, "error": None, "timings": {}, "started_at": time.time()}
        _job_controls[job_id] = {"cancel": threading.Event(), "process": None, "render_started": False}
    thread = threading.Thread(target=_export_worker, args=(job_id, project_id, kind, source, cues, style, offset), daemon=True)
    thread.start()
    return job_id, False


def cancel_job(job_id: str) -> dict[str, Any] | None:
    with _jobs_lock:
        job = jobs.get(job_id)
        control = _job_controls.get(job_id)
        if not job:
            return None
        if job.get("status") in {"done", "error"}:
            return dict(job)
        if control:
            control["cancel"].set()
            process = control.get("process")
            if process and process.poll() is None:
                process.kill()
        return dict(job)


def _export_worker(job_id: str, project_id: str, kind: str, source: Path, cues: list[dict[str, Any]], style: dict[str, Any], offset: float) -> None:
    folder = STORAGE_ROOT / project_id
    output = folder / f"export_{kind}.mp4"
    ass_path = folder / f"export_{kind}.ass"
    log_path = folder / f"export_{kind}.log"
    started = time.monotonic()
    active_step: list[Any] = ["Queued", started]
    step_timings: dict[str, float] = {}
    deadline = started + 600
    control = _job_controls[job_id]

    def log_message(message: str) -> None:
        with log_path.open("a", encoding="utf-8", errors="replace") as log:
            log.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}\n")

    def update(**values: Any) -> None:
        with _jobs_lock:
            jobs[job_id].update(values)

    def step(name: str) -> None:
        now = time.monotonic()
        previous_name, previous_start = active_step
        if previous_name:
            step_timings[previous_name] = step_timings.get(previous_name, 0) + now - previous_start
        active_step[:] = [name, now]
        update(step=name, timings=dict(step_timings))
        log_message(f"STEP {name}")

    try:
        log_path.write_text(f"Export job {job_id} ({kind})\n", encoding="utf-8")
        update(status="running", step="Preparing fonts", percent=0, indeterminate=False)
        step("Preparing fonts")
        while not _warmup_done.wait(.5):
            if control["cancel"].is_set():
                raise ExportFailure("Export cancelled by the user")
            if time.monotonic() >= deadline:
                raise ExportFailure("Export exceeded the maximum runtime while preparing fonts")
        if control["cancel"].is_set():
            raise ExportFailure("Export cancelled by the user")
        step("Reading video")
        metadata = probe_video(source)
        if metadata.get("duration"):
            deadline = started + max(600, metadata["duration"] * 8)
        update(indeterminate=not bool(metadata.get("duration")))
        log_message(f"SOURCE width={metadata['width']} height={metadata['height']} fps={metadata['fps']} duration={metadata['duration']}")
        step("Building captions")
        ass_path.write_text(build_ass(cues, style, metadata["width"], metadata["height"], offset), encoding="utf-8-sig")
        step("Rendering green-screen video" if kind == "greenscreen" else "Burning captions into video")
        _run_ffmpeg(job_id, kind, source, output, ass_path, metadata, log_path, deadline, lambda percent, indeterminate: update(percent=percent, indeterminate=indeterminate))
        step("Finalizing export")
        if not output.is_file() or output.stat().st_size <= 0:
            raise ExportFailure("Export finished but the output file is missing or empty")
        update(status="done", step="Done", percent=100 if metadata.get("duration") else None, indeterminate=not bool(metadata.get("duration")), error=None)
    except BaseException as exc:
        logger.exception("Export job %s failed", job_id)
        if control.get("render_started"):
            try:
                output.unlink(missing_ok=True)
            except OSError:
                pass
        update(status="error", step="Error", error=str(exc))
        try:
            log_message(f"JOB ERROR: {exc}")
        except OSError:
            logger.exception("Could not write export error log %s", log_path)
    finally:
        process = control.get("process")
        if process and process.poll() is None:
            process.kill()
            process.wait()
        previous_name, previous_start = active_step
        if previous_name:
            step_timings[previous_name] = step_timings.get(previous_name, 0) + time.monotonic() - previous_start
        step_timings["total"] = time.monotonic() - started
        with _jobs_lock:
            job = jobs[job_id]
            if job.get("status") not in {"done", "error"}:
                job.update(status="error", step="Error", error="Export ended unexpectedly before reaching a terminal state")
            job["timings"] = dict(step_timings)
        try:
            log_message(f"STEP TIMINGS {json.dumps(step_timings, sort_keys=True)}")
        except OSError:
            logger.exception("Could not finalize export log %s", log_path)
        with _job_lock:
            _job_controls.pop(job_id, None)


def get_job(job_id: str) -> dict[str, Any] | None:
    with _jobs_lock:
        job = jobs.get(job_id)
        return dict(job) if job else None
