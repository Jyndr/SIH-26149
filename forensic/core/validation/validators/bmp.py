"""
BMP structural validator.

Critical: "BM" is only 2 bytes, producing massive false positives.
This validator checks file size field, reserved bytes (must be 0),
data offset, DIB header size, and dimensions.
"""
import struct
from core.types import ValidationResult
from core.image_reader.base import ImageReader
from core.validation.validator import FormatValidator

_VALID_DIB_SIZES = {12, 40, 52, 56, 64, 108, 124}


class BmpValidator(FormatValidator):

    def validate(self, reader: ImageReader, offset: int, format_name: str) -> ValidationResult:
        factors = {}
        details = []

        header = reader.read_at(offset, 54)  # BMP header(14) + BITMAPINFOHEADER(40)
        if len(header) < 26:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Not enough data")

        if header[0:2] != b"BM":
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Missing BM signature")
        factors["valid_header"] = 0.15

        # File size field (bytes 2-5, LE)
        file_size = struct.unpack("<I", header[2:6])[0]
        if file_size < 26 or file_size > 500 * 1024 * 1024:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    confidence_factors=factors,
                                    error=f"Unreasonable BMP file size: {file_size}")
        factors["valid_file_size"] = 0.20
        details.append(f"File size: {file_size:,}")

        # Reserved fields (bytes 6-9) MUST be zero
        reserved = struct.unpack("<HH", header[6:10])
        if reserved != (0, 0):
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    confidence_factors=factors,
                                    error=f"Non-zero reserved fields: {reserved}")
        factors["valid_reserved"] = 0.15
        details.append("Reserved fields are zero")

        # Data offset (bytes 10-13)
        data_offset = struct.unpack("<I", header[10:14])[0]
        if data_offset < 26 or data_offset > file_size:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    confidence_factors=factors,
                                    error=f"Invalid data offset: {data_offset}")

        # DIB header size (bytes 14-17)
        dib_size = struct.unpack("<I", header[14:18])[0]
        if dib_size not in _VALID_DIB_SIZES:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    confidence_factors=factors,
                                    error=f"Invalid DIB header size: {dib_size}")
        factors["valid_dib_header"] = 0.20
        details.append(f"DIB header size: {dib_size}")

        # Width/height (for BITMAPINFOHEADER, 40-byte)
        if dib_size >= 40 and len(header) >= 26:
            width = struct.unpack("<i", header[18:22])[0]
            height = struct.unpack("<i", header[22:26])[0]
            if 1 <= abs(width) <= 65535 and 1 <= abs(height) <= 65535:
                factors["valid_dimensions"] = 0.15
                details.append(f"Dimensions: {width}x{abs(height)}")

        if file_size <= 500 * 1024 * 1024:
            factors["reasonable_size"] = 0.15

        score = sum(factors.values())
        return ValidationResult(
            valid=score >= 0.50, format_name=format_name, offset=offset,
            estimated_size=file_size, confidence_score=score,
            confidence_factors=factors, details="; ".join(details),
        )


FormatValidator.register("bmp", BmpValidator())
