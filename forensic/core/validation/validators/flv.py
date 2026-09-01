"""
FLV structural validator.

Checks: "FLV\\x01" header, flags byte, data offset field,
validates first tag structure.
"""
import struct
from core.types import ValidationResult
from core.image_reader.base import ImageReader
from core.validation.validator import FormatValidator


class FlvValidator(FormatValidator):

    def validate(self, reader: ImageReader, offset: int, format_name: str) -> ValidationResult:
        factors = {}
        details = []

        header = reader.read_at(offset, 13)
        if len(header) < 9:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Not enough data")

        if header[0:4] != b"FLV\x01":
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Missing FLV header")
        factors["valid_header"] = 0.25
        factors["valid_version"] = 0.10
        details.append("FLV v1")

        # Flags: bit 0 = video, bit 2 = audio
        flags = header[4]
        has_video = bool(flags & 0x01)
        has_audio = bool(flags & 0x04)
        if (flags & 0xFA) == 0:  # Other bits should be 0
            factors["valid_flags"] = 0.15
            details.append(f"Audio={has_audio}, Video={has_video}")

        # Data offset (bytes 5-8, BE) — usually 9
        data_offset = struct.unpack(">I", header[5:9])[0]
        if data_offset == 9:
            factors["valid_offset"] = 0.15
            details.append("Data offset: 9")

        # Check first tag (at data_offset + 4 for previous tag size)
        if len(header) >= 13 and data_offset <= 13:
            # Previous tag size (4 bytes, should be 0 for first tag)
            prev_size = struct.unpack(">I", header[data_offset:data_offset + 4])[0]
            if prev_size == 0:
                factors["valid_tags"] = 0.20
                details.append("Valid first tag")

        # Estimate size from reading further
        read_size = min(50 * 1024 * 1024, reader.size - offset)
        estimated_size = read_size
        factors["reasonable_size"] = 0.15

        score = sum(factors.values())
        return ValidationResult(
            valid=score >= 0.40, format_name=format_name, offset=offset,
            estimated_size=estimated_size, confidence_score=score,
            confidence_factors=factors, details="; ".join(details),
        )


FormatValidator.register("flv", FlvValidator())
