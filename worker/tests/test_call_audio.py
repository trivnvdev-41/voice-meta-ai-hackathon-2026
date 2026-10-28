import math
import shutil
import struct

import pytest

from src.call_audio import FRAME_BYTES, UtteranceSegmenter, decode_to_slinear8k, rms


def tone(freq: float = 440.0, secs: float = 1.0, amp: int = 5000) -> bytes:
    frames = []
    for i in range(int(8000 * secs)):
        frames.append(struct.pack("<h", int(amp * math.sin(2 * math.pi * freq * i / 8000))))
    return b"".join(frames)


def silence(secs: float = 1.0) -> bytes:
    return b"\x00" * int(8000 * secs * 2)


def chunks(data: bytes, size: int = FRAME_BYTES):
    return [data[i : i + size] for i in range(0, len(data), size)]


def test_rms_silence_vs_tone() -> None:
    assert rms(silence(0.1)) == 0.0
    assert rms(tone(secs=0.1)) > 1000.0


def test_segmenter_emits_after_hangover() -> None:
    seg = UtteranceSegmenter(threshold=500.0, hangover_frames=5, min_frames=3)
    out = None
    for frame in chunks(tone(secs=0.5)) + chunks(silence(secs=0.5)):
        result = seg.feed(frame)
        if result is not None:
            out = result
    assert out is not None
    assert len(out) >= 0.5 * 8000 * 2


def test_segmenter_ignores_short_blip() -> None:
    seg = UtteranceSegmenter(threshold=500.0, hangover_frames=5, min_frames=30)
    for frame in chunks(tone(secs=0.05)) + chunks(silence(secs=1.0)):
        assert seg.feed(frame) is None
    assert seg.flush() is None


def test_segmenter_flush_returns_partial() -> None:
    seg = UtteranceSegmenter(threshold=500.0, min_frames=3)
    for frame in chunks(tone(secs=0.5)):
        seg.feed(frame)
    out = seg.flush()
    assert out is not None and len(out) > 0


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="needs ffmpeg binary")
def test_decode_wav_to_slinear8k() -> None:
    import io
    import wave

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(8000)
        wav.writeframes(tone(secs=0.5))
    raw = decode_to_slinear8k(buf.getvalue(), input_format="wav")
    assert len(raw) == int(0.5 * 8000 * 2)
