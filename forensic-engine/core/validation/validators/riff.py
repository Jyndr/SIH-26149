"""
RIFF structural validator — handles WAV, AVI, and WebP.

Checks: RIFF header, size field, subtype at offset 8,
format-specific sub-chunks (fmt for WAV, hdrl for AVI).

IMPORTANT: The old code mapped RIFF to both WAV and AVI,
double-counting. This validator reads the actual subtype
to correctly classify.
"""
import struct
from core.types import ValidationResult
from core.image_reader.base import ImageReader
from core.validation.validator import FormatValidator

_KNOWN_SUBTYPES = {b"WAVE": "wav", b"AVI ": "avi", b"WEBP": "webp"}


class RiffValidator(FormatValidator):

    def validate(self, reader: ImageReader, offset: int, format_name: str) -> ValidationResult:
        factors = {}
        details = []

        header = reader.read_at(offset, 12)
        if len(header) < 12:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Not enough data for RIFF header")

        if header[0:4] != b"RIFF":
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Missing RIFF signature")

        # Size field (bytes 4-7, LE) — total file size minus 8
        riff_size = struct.unpack("<I", header[4:8])[0]
        file_size = riff_size + 8
        factors["valid_riff_header"] = 0.20

        # Subtype at offset 8
        subtype = header[8:12]
        subtype_str = subtype.decode("ascii", errors="replace")
        actual_format = _KNOWN_SUBTYPES.get(subtype)

        if actual_format is None:
            return ValidationResult(
                valid=False, format_name=format_name, offset=offset,
                confidence_factors=factors,
                error=f"Unknown RIFF subtype: {subtype_str!r}",
            )

        # If scanner guessed a different RIFF format, reclassify
        resolved_name = actual_format
        factors["valid_subtype"] = 0.20
        details.append(f"RIFF/{subtype_str.strip()}")

        # Validate size
        if 12 <= file_size <= 4 * 1024 * 1024 * 1024:
            factors["valid_size_field"] = 0.15
            details.append(f"Size: {file_size:,} bytes")

        # Read sub-chunks for format-specific validation
        chunk_data = reader.read_at(offset + 12, min(file_size - 12, 4096))

        if actual_format == "wav":
            if b"fmt " in chunk_data:
                factors["valid_fmt"] = 0.20
                details.append("Found 'fmt ' chunk")
            if b"data" in chunk_data:
                factors["valid_data"] = 0.10
                details.append("Found 'data' chunk")

        elif actual_format == "avi":
            if b"hdrl" in chunk_data or b"LIST" in chunk_data:
                factors["valid_hdrl"] = 0.20
                details.append("Found AVI LIST/hdrl")
            if b"movi" in chunk_data:
                factors["valid_movi"] = 0.10
                details.append("Found 'movi' chunk")

        elif actual_format == "webp":
            if b"VP8" in chunk_data or b"VP8L" in chunk_data or b"VP8X" in chunk_data:
                factors["valid_chunks"] = 0.20
                details.append("Found VP8 data")

        factors["reasonable_size"] = 0.15

        score = sum(factors.values())
        return ValidationResult(
            valid=score >= 0.40, format_name=resolved_name, offset=offset,
            estimated_size=file_size, confidence_score=score,
            confidence_factors=factors, details="; ".join(details),
        )


FormatValidator.register("riff", RiffValidator())
