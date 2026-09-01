"""
MPEG-1/2 Program Stream validator.

Checks: pack header (00 00 01 BA) or sequence header (00 00 01 B3),
validates version bits, searches for program end code (00 00 01 B9).
"""
import struct
from core.types import ValidationResult
from core.image_reader.base import ImageReader
from core.validation.validator import FormatValidator


class MpgValidator(FormatValidator):

    def validate(self, reader: ImageReader, offset: int, format_name: str) -> ValidationResult:
        factors = {}
        details = []

        header = reader.read_at(offset, 16)
        if len(header) < 4:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Not enough data")

        start_code = header[0:4]

        if start_code == b"\x00\x00\x01\xBA":  # Pack header
            factors["valid_header"] = 0.25
            details.append("MPEG pack header")
            # Check version bits (byte 4)
            if len(header) >= 5:
                if (header[4] & 0xC0) == 0x40:  # MPEG-2
                    factors["valid_pack"] = 0.15
                    details.append("MPEG-2")
                elif (header[4] & 0xF0) == 0x20:  # MPEG-1
                    factors["valid_pack"] = 0.15
                    details.append("MPEG-1")

        elif start_code == b"\x00\x00\x01\xB3":  # Sequence header
            factors["valid_header"] = 0.25
            details.append("MPEG sequence header")
            if len(header) >= 8:
                # Width: 12 bits, Height: 12 bits
                w = (header[4] << 4) | (header[5] >> 4)
                h = ((header[5] & 0x0F) << 8) | header[6]
                if 16 <= w <= 4096 and 16 <= h <= 4096:
                    factors["valid_system"] = 0.15
                    details.append(f"Dimensions: {w}x{h}")
        else:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Invalid MPEG start code")

        # Search for program end code (00 00 01 B9)
        read_size = min(50 * 1024 * 1024, reader.size - offset)
        tail_size = min(4096, read_size)
        tail = reader.read_at(offset + read_size - tail_size, tail_size)
        estimated_size = read_size

        if b"\x00\x00\x01\xB9" in tail:
            end_pos = tail.rfind(b"\x00\x00\x01\xB9")
            estimated_size = read_size - tail_size + end_pos + 4
            factors["valid_footer"] = 0.15
            details.append("Found program end code")

        # Check for PES packets (00 00 01 Ex or 00 00 01 Cx)
        first_chunk = reader.read_at(offset, min(read_size, 8192))
        pes_count = 0
        for i in range(len(first_chunk) - 3):
            if first_chunk[i:i + 3] == b"\x00\x00\x01":
                sc = first_chunk[i + 3]
                if 0xC0 <= sc <= 0xEF:
                    pes_count += 1
        if pes_count >= 2:
            factors["valid_pes"] = 0.15
            details.append(f"{pes_count} PES packets")

        factors["reasonable_size"] = 0.15

        score = sum(factors.values())
        return ValidationResult(
            valid=score >= 0.40, format_name=format_name, offset=offset,
            estimated_size=estimated_size, confidence_score=score,
            confidence_factors=factors, details="; ".join(details),
        )


FormatValidator.register("mpg", MpgValidator())
