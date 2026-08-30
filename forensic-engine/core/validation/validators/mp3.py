"""
MP3 structural validator.

Checks: ID3v2 tag (header, version, size) or MPEG frame sync
(FF FB/F3/F2 + valid bitrate/sample rate).
"""
import struct
from core.types import ValidationResult
from core.image_reader.base import ImageReader
from core.validation.validator import FormatValidator

# MPEG1 Layer III bitrate table (kbps), index 0 = free, 15 = bad
_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1]
_SAMPLE_RATES = [44100, 48000, 32000, -1]


class Mp3Validator(FormatValidator):

    def validate(self, reader: ImageReader, offset: int, format_name: str) -> ValidationResult:
        factors = {}
        details = []

        header = reader.read_at(offset, 10)
        if len(header) < 4:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Not enough data")

        estimated_size = 0

        # Check for ID3v2 tag
        if header[0:3] == b"ID3":
            factors["valid_header"] = 0.20
            if len(header) >= 10:
                major, minor = header[3], header[4]
                flags = header[5]
                # Syncsafe size
                size_bytes = header[6:10]
                id3_size = (size_bytes[0] << 21) | (size_bytes[1] << 14) | (size_bytes[2] << 7) | size_bytes[3]
                if major <= 4 and id3_size > 0:
                    factors["valid_id3"] = 0.15
                    details.append(f"ID3v2.{major}.{minor}, tag size: {id3_size}")
                    # After ID3 tag, check for MPEG sync
                    audio_start = offset + 10 + id3_size
                    sync = reader.read_at(audio_start, 4)
                    if len(sync) >= 2 and sync[0] == 0xFF and (sync[1] & 0xE0) == 0xE0:
                        factors["valid_frame_sync"] = 0.20
                        details.append("MPEG frame sync after ID3")
                        # Estimate size from file system or a reasonable read
                        estimated_size = min(reader.size - offset, 500 * 1024 * 1024)
        else:
            # Raw MPEG sync
            if header[0] == 0xFF and (header[1] & 0xE0) == 0xE0:
                factors["valid_header"] = 0.20
                factors["valid_frame_sync"] = 0.20
                details.append("MPEG frame sync")

                if len(header) >= 4:
                    # Parse frame header
                    b1, b2 = header[2], header[3]
                    bitrate_idx = (b1 >> 4) & 0x0F
                    sr_idx = (b1 >> 2) & 0x03
                    if bitrate_idx not in (0, 15) and sr_idx != 3:
                        bitrate = _BITRATES[bitrate_idx]
                        sample_rate = _SAMPLE_RATES[sr_idx]
                        factors["valid_frame_header"] = 0.15
                        details.append(f"Bitrate: {bitrate}kbps, SR: {sample_rate}Hz")

                estimated_size = min(reader.size - offset, 500 * 1024 * 1024)

        if estimated_size > 128:
            factors["reasonable_size"] = 0.15

        score = sum(factors.values())
        return ValidationResult(
            valid=score >= 0.35, format_name=format_name, offset=offset,
            estimated_size=estimated_size, confidence_score=score,
            confidence_factors=factors, details="; ".join(details),
        )


FormatValidator.register("mp3", Mp3Validator())
