"""
PNG structural validator.

Checks: 8-byte signature, IHDR chunk (width/height/bit depth/color type),
CRC on IHDR, scans for IEND chunk.
"""
import struct
import zlib
from core.types import ValidationResult
from core.image_reader.base import ImageReader
from core.validation.validator import FormatValidator

_PNG_SIG = b"\x89PNG\x0D\x0A\x1A\x0A"
_READ_LIMIT = 50 * 1024 * 1024


class PngValidator(FormatValidator):

    def validate(self, reader: ImageReader, offset: int, format_name: str) -> ValidationResult:
        factors = {}
        details = []

        header = reader.read_at(offset, 33)  # sig(8) + IHDR length(4) + type(4) + data(13) + crc(4)
        if len(header) < 33:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Not enough data for PNG header")

        # Check signature
        if header[0:8] != _PNG_SIG:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Invalid PNG signature")
        factors["valid_header"] = 0.20
        details.append("Valid PNG signature")

        # Check IHDR chunk
        ihdr_len = struct.unpack(">I", header[8:12])[0]
        ihdr_type = header[12:16]
        if ihdr_type != b"IHDR" or ihdr_len != 13:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    confidence_factors=factors, error="Missing or invalid IHDR")

        width = struct.unpack(">I", header[16:20])[0]
        height = struct.unpack(">I", header[20:24])[0]
        bit_depth = header[24]
        color_type = header[25]

        if width > 0 and height > 0 and bit_depth in (1, 2, 4, 8, 16) and color_type in (0, 2, 3, 4, 6):
            factors["valid_ihdr"] = 0.15
            details.append(f"IHDR: {width}x{height}, depth={bit_depth}, color={color_type}")

        # CRC check on IHDR
        ihdr_data = header[12:29]  # type(4) + data(13)
        stored_crc = struct.unpack(">I", header[29:33])[0]
        computed_crc = zlib.crc32(ihdr_data) & 0xFFFFFFFF
        if stored_crc == computed_crc:
            factors["valid_crc"] = 0.15
            details.append("IHDR CRC valid")

        # Scan for IEND chunk
        estimated_size = 0
        read_size = min(_READ_LIMIT, reader.size - offset)
        chunk_size = min(read_size, 2 * 1024 * 1024)
        data = reader.read_at(offset, chunk_size)

        # Walk chunks
        pos = 8  # after PNG signature
        valid_chunks = 0
        found_iend = False

        while pos + 12 <= len(data):
            c_len = struct.unpack(">I", data[pos:pos + 4])[0]
            c_type = data[pos + 4:pos + 8]
            chunk_end = pos + 12 + c_len

            if c_len > 100 * 1024 * 1024:  # Unreasonable chunk size
                break

            # Validate chunk type is ASCII letters
            if all(65 <= b <= 122 for b in c_type):
                valid_chunks += 1

            if c_type == b"IEND":
                found_iend = True
                estimated_size = chunk_end
                break

            if chunk_end > len(data):
                # Need more data — try extended read for IEND
                if chunk_size < read_size:
                    tail = reader.read_at(offset + len(data), min(read_size - len(data), 2 * 1024 * 1024))
                    iend_pos = tail.find(b"IEND")
                    if iend_pos != -1:
                        found_iend = True
                        estimated_size = len(data) + iend_pos + 12
                break

            pos = chunk_end

        if valid_chunks >= 2:
            factors["valid_chunks"] = 0.20
            details.append(f"{valid_chunks} valid chunks")
        if found_iend:
            factors["valid_iend"] = 0.15
            details.append("Found IEND")
        if estimated_size > 0 and estimated_size <= 500 * 1024 * 1024:
            factors["reasonable_size"] = 0.15
            details.append(f"Size: {estimated_size:,} bytes")

        score = sum(factors.values())
        valid = score >= 0.35 and "valid_header" in factors

        return ValidationResult(
            valid=valid, format_name=format_name, offset=offset,
            estimated_size=estimated_size, confidence_score=score,
            confidence_factors=factors, details="; ".join(details),
        )


FormatValidator.register("png", PngValidator())
