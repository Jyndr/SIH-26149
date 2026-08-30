"""Structure-aware MP3 validator.

A two-byte MPEG sync word occurs frequently in arbitrary binary data. MP3
candidates are accepted only when at least three consecutive, compatible Layer
III frames can be walked using their calculated frame sizes. The same walk
supplies a real carve boundary instead of the global maximum-carve size.
"""
from __future__ import annotations

from dataclasses import dataclass

from core.image_reader.base import ImageReader
from core.types import ValidationResult
from core.validation.validator import FormatValidator


_BITRATES_MPEG1_L3 = (0, 32, 40, 48, 56, 64, 80, 96,
                      112, 128, 160, 192, 224, 256, 320, -1)
_BITRATES_MPEG2_L3 = (0, 8, 16, 24, 32, 40, 48, 56,
                      64, 80, 96, 112, 128, 144, 160, -1)
_BASE_SAMPLE_RATES = (44100, 48000, 32000)
_MIN_CONSECUTIVE_FRAMES = 3


@dataclass(frozen=True, slots=True)
class _FrameHeader:
    version: str
    layer: int
    bitrate_kbps: int
    sample_rate: int
    frame_size: int


def _parse_frame_header(data: bytes) -> _FrameHeader | None:
    """Parse one MPEG Layer III header and reject reserved/invalid values."""
    if len(data) < 4:
        return None
    value = int.from_bytes(data[:4], "big")
    if (value >> 21) & 0x7FF != 0x7FF:
        return None

    version_bits = (value >> 19) & 0x03
    layer_bits = (value >> 17) & 0x03
    bitrate_index = (value >> 12) & 0x0F
    sample_rate_index = (value >> 10) & 0x03
    padding = (value >> 9) & 0x01
    emphasis = value & 0x03

    if version_bits == 0x01 or layer_bits != 0x01:
        return None
    if bitrate_index in (0, 15) or sample_rate_index == 3 or emphasis == 2:
        return None

    if version_bits == 0x03:
        version = "1"
        bitrate = _BITRATES_MPEG1_L3[bitrate_index]
        sample_rate = _BASE_SAMPLE_RATES[sample_rate_index]
        frame_size = (144000 * bitrate) // sample_rate + padding
    else:
        version = "2" if version_bits == 0x02 else "2.5"
        divisor = 2 if version_bits == 0x02 else 4
        bitrate = _BITRATES_MPEG2_L3[bitrate_index]
        sample_rate = _BASE_SAMPLE_RATES[sample_rate_index] // divisor
        frame_size = (72000 * bitrate) // sample_rate + padding

    if frame_size < 24:
        return None
    return _FrameHeader(version, 3, bitrate, sample_rate, frame_size)


def _id3_audio_start(reader: ImageReader, offset: int) -> tuple[int, str] | None:
    header = reader.read_at(offset, 10)
    if len(header) < 10 or header[:3] != b"ID3":
        return None
    major, minor, flags = header[3], header[4], header[5]
    size_bytes = header[6:10]
    if major not in (2, 3, 4) or minor == 0xFF:
        return None
    if any(byte & 0x80 for byte in size_bytes):
        return None
    allowed_flags = {2: 0xC0, 3: 0xE0, 4: 0xF0}[major]
    if flags & ~allowed_flags:
        return None
    tag_size = ((size_bytes[0] << 21) | (size_bytes[1] << 14)
                | (size_bytes[2] << 7) | size_bytes[3])
    audio_start = offset + 10 + tag_size
    if audio_start > reader.size:
        return None
    return audio_start, f"ID3v2.{major}.{minor}, tag size: {tag_size}"


class Mp3Validator(FormatValidator):

    def validate(self, reader: ImageReader, offset: int, format_name: str) -> ValidationResult:
        if offset < 0 or offset + 4 > reader.size:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Not enough data")

        factors: dict[str, float] = {}
        details: list[str] = []
        audio_start = offset
        id3 = _id3_audio_start(reader, offset)
        if id3 is not None:
            audio_start, id3_detail = id3
            factors["valid_header"] = 0.20
            factors["valid_id3"] = 0.15
            details.append(id3_detail)

        first = _parse_frame_header(reader.read_at(audio_start, 4))
        if first is None:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="No valid MPEG Layer III frame")

        if id3 is None:
            factors["valid_header"] = 0.20
        factors["valid_frame_sync"] = 0.20
        factors["valid_frame_header"] = 0.15

        position = audio_start
        frame_count = 0
        bitrates: set[int] = set()
        while position + 4 <= reader.size:
            frame = _parse_frame_header(reader.read_at(position, 4))
            if frame is None:
                break
            if (frame.version, frame.layer, frame.sample_rate) != (
                    first.version, first.layer, first.sample_rate):
                break
            if position + frame.frame_size > reader.size:
                break
            bitrates.add(frame.bitrate_kbps)
            frame_count += 1
            position += frame.frame_size

        if frame_count < _MIN_CONSECUTIVE_FRAMES:
            return ValidationResult(
                valid=False, format_name=format_name, offset=offset,
                error=f"Only {frame_count} consecutive compatible MP3 frame(s); "
                      f"need {_MIN_CONSECUTIVE_FRAMES}",
            )

        if position + 128 <= reader.size and reader.read_at(position, 3) == b"TAG":
            position += 128
            details.append("ID3v1 trailer")

        estimated_size = position - offset
        factors["consistent_bitrate"] = 0.15
        factors["reasonable_size"] = 0.15
        details.extend([
            f"MPEG-{first.version} Layer III",
            f"{frame_count} consecutive frames",
            f"sample rate: {first.sample_rate}Hz",
            "bitrate(s): " + ", ".join(f"{rate}kbps" for rate in sorted(bitrates)),
        ])
        score = sum(factors.values())
        return ValidationResult(
            valid=True, format_name=format_name, offset=offset,
            estimated_size=estimated_size, confidence_score=score,
            confidence_factors=factors, details="; ".join(details),
        )


FormatValidator.register("mp3", Mp3Validator())
