"""
JPEG structural validator.

Checks: SOI marker, APP marker type, scans marker structure,
searches for EOI footer, validates reasonable size.
"""
import struct
from core.types import ValidationResult
from core.image_reader.base import ImageReader
from core.validation.validator import FormatValidator

# Valid JPEG marker second bytes (after 0xFF)
_VALID_MARKERS = set(range(0xC0, 0xFF)) - {0xFF}
_READ_LIMIT = 50 * 1024 * 1024  # Don't read more than 50 MB for validation


class JpegValidator(FormatValidator):

    def validate(self, reader: ImageReader, offset: int, format_name: str) -> ValidationResult:
        factors = {}
        details = []

        header = reader.read_at(offset, 16)
        if len(header) < 4:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Not enough data")

        # Check SOI
        if header[0:2] != b"\xFF\xD8":
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Missing SOI marker")
        factors["valid_header"] = 0.20
        details.append("Valid SOI marker")

        # Check APP marker
        if header[2] == 0xFF and header[3] in (0xE0, 0xE1, 0xE2, 0xEE, 0xDB, 0xC0, 0xC4):
            factors["valid_app_marker"] = 0.10
            details.append(f"Valid marker after SOI: FF {header[3]:02X}")

        # Walk marker structure and look for EOI
        estimated_size = 0
        valid_markers = 0
        found_eoi = False
        pos = 2  # after SOI
        read_size = min(_READ_LIMIT, reader.size - offset)

        # Read a reasonable chunk for marker walking
        chunk_size = min(read_size, 2 * 1024 * 1024)
        data = reader.read_at(offset, chunk_size)

        while pos < len(data) - 1:
            if data[pos] != 0xFF:
                pos += 1
                continue

            marker = data[pos + 1]

            if marker == 0xD9:  # EOI
                found_eoi = True
                estimated_size = pos + 2
                break

            if marker == 0x00 or marker == 0xFF:
                pos += 1
                continue

            if marker == 0xDA:  # SOS — start of scan data, skip to near end
                # After SOS, scan data follows until EOI
                eoi_pos = data.find(b"\xFF\xD9", pos + 2)
                if eoi_pos != -1:
                    found_eoi = True
                    estimated_size = eoi_pos + 2
                else:
                    # EOI might be beyond our read chunk — search further
                    if chunk_size < read_size:
                        tail = reader.read_at(offset + len(data) - 2, min(read_size - len(data) + 2, 5 * 1024 * 1024))
                        eoi_pos2 = tail.find(b"\xFF\xD9")
                        if eoi_pos2 != -1:
                            found_eoi = True
                            estimated_size = (len(data) - 2) + eoi_pos2 + 2
                    estimated_size = estimated_size or read_size
                break

            if marker in _VALID_MARKERS:
                valid_markers += 1

            # Read marker segment length
            if pos + 3 < len(data):
                seg_len = struct.unpack(">H", data[pos + 2:pos + 4])[0]
                pos += 2 + seg_len
            else:
                break

        if found_eoi:
            factors["valid_footer"] = 0.20
            details.append(f"Found EOI at offset +{estimated_size}")
        if valid_markers >= 2:
            factors["valid_marker_structure"] = 0.20
            details.append(f"{valid_markers} valid markers found")
        if 107 <= estimated_size <= 100 * 1024 * 1024:
            factors["reasonable_size"] = 0.15
            details.append(f"Reasonable size: {estimated_size:,} bytes")

        score = sum(factors.values())
        valid = score >= 0.40 and "valid_header" in factors

        return ValidationResult(
            valid=valid, format_name=format_name, offset=offset,
            estimated_size=estimated_size, confidence_score=score,
            confidence_factors=factors, details="; ".join(details),
        )


FormatValidator.register("jpeg", JpegValidator())
