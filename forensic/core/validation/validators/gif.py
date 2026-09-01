"""
GIF structural validator.

Checks: version string (87a/89a), logical screen descriptor
(width/height), searches for trailer byte (0x3B).
"""
import struct
from core.types import ValidationResult
from core.image_reader.base import ImageReader
from core.validation.validator import FormatValidator


class GifValidator(FormatValidator):

    def validate(self, reader: ImageReader, offset: int, format_name: str) -> ValidationResult:
        factors = {}
        details = []

        header = reader.read_at(offset, 13)
        if len(header) < 13:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Not enough data")

        # Version
        version = header[0:6]
        if version not in (b"GIF87a", b"GIF89a"):
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Invalid GIF version")
        factors["valid_header"] = 0.25
        details.append(f"Version: {version.decode()}")

        # Logical Screen Descriptor
        width = struct.unpack("<H", header[6:8])[0]
        height = struct.unpack("<H", header[8:10])[0]
        if 1 <= width <= 65535 and 1 <= height <= 65535:
            factors["valid_screen_descriptor"] = 0.15
            details.append(f"Dimensions: {width}x{height}")

        # Search for trailer
        read_size = min(10 * 1024 * 1024, reader.size - offset)
        data = reader.read_at(offset, min(read_size, 2 * 1024 * 1024))
        trailer_pos = data.rfind(b"\x00\x3B")
        estimated_size = 0
        if trailer_pos != -1:
            estimated_size = trailer_pos + 2
            factors["valid_trailer"] = 0.20
            details.append("Found GIF trailer")

        if estimated_size > 0 and estimated_size <= 100 * 1024 * 1024:
            factors["reasonable_size"] = 0.20
            details.append(f"Size: {estimated_size:,} bytes")

        score = sum(factors.values())
        return ValidationResult(
            valid=score >= 0.40, format_name=format_name, offset=offset,
            estimated_size=estimated_size, confidence_score=score,
            confidence_factors=factors, details="; ".join(details),
        )


FormatValidator.register("gif", GifValidator())
