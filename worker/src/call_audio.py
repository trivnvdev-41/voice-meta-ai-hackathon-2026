"""8 kHz slinear16 helpers: RMS VAD segmentation + ffmpeg decode."""
from __future__ import annotations

import shutil
import struct
import subprocess

SAMPLE_RATE = 8000
FRAME_MS = 20
FRAME_BYTES = SAMPLE_RATE * FRAME_MS // 1000 * 2


def rms(frame: bytes) -> float:
    count = len(frame) // 2
    if count == 0:
        return 0.0
    total = 0
    for (value,) in struct.iter_unpack("<h", frame[: count * 2]):
        total += value * value
    return (total / count) ** 0.5


class UtteranceSegmenter:
    """Collects frames until end-of-speech. Fixed RMS threshold (MVP)."""

    def __init__(
        self,
        threshold: float = 500.0,
        hangover_frames: int = 30,
        max_frames: int = 1000,
        min_frames: int = 15,
    ) -> None:
        self.threshold = threshold
        self.hangover_frames = hangover_frames
        self.max_frames = max_frames
        self.min_frames = min_frames
        self._buf: list[bytes] = []
        self._silence = 0

    def feed(self, frame: bytes) -> bytes | None:
        if rms(frame) >= self.threshold:
            self._buf.append(frame)
            self._silence = 0
        elif self._buf:
            self._buf.append(frame)
            self._silence += 1
        if len(self._buf) >= self.max_frames:
            return self._take()
        if self._buf and self._silence >= self.hangover_frames:
            return self._take()
        return None

    def flush(self) -> bytes | None:
        return self._take()

    def _take(self) -> bytes | None:
        frames, self._buf, self._silence = self._buf, [], 0
        if len(frames) < self.min_frames:
            return None
        return b"".join(frames)


def decode_to_slinear8k(data: bytes, input_format: str = "mp3") -> bytes:
    ffmpeg = shutil.which("ffmpeg") or "ffmpeg"
    proc = subprocess.run(
        [
            ffmpeg, "-hide_banner", "-loglevel", "error",
            "-f", input_format, "-i", "pipe:0",
            "-f", "s16le", "-ac", "1", "-ar", str(SAMPLE_RATE), "pipe:1",
        ],
        input=data,
        capture_output=True,
        timeout=60,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg decode failed: {proc.stderr.decode()[:200]}")
    return proc.stdout
