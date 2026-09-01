"""
ZIP structural validator.

Checks: PK local file header fields (version, compression method,
filename length), searches for end of central directory (PK\\x05\\x06).
"""
import struct
from core.types import ValidationResult
from core.image_reader.base import ImageReader
from core.validation.validator import FormatValidator

_VALID_COMPRESSION = {0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 14, 18, 19, 97, 98}


class ZipValidator(FormatValidator):

    def validate(self, reader: ImageReader, offset: int, format_name: str) -> ValidationResult:
        factors = {}
        details = []

        header = reader.read_at(offset, 30)
        if len(header) < 30:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Not enough data")

        if header[0:4] != b"PK\x03\x04":
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Missing PK signature")
        factors["valid_header"] = 0.15

        # Version needed
        version = struct.unpack("<H", header[4:6])[0]
        if version <= 100:  # Reasonable version
            details.append(f"Version needed: {version / 10:.1f}")

        # Compression method
        method = struct.unpack("<H", header[8:10])[0]
        if method in _VALID_COMPRESSION:
            factors["valid_compression"] = 0.10
            details.append(f"Compression: {method}")

        # Filename length
        fname_len = struct.unpack("<H", header[26:28])[0]
        extra_len = struct.unpack("<H", header[28:30])[0]
        if 1 <= fname_len <= 512:
            factors["valid_local_header"] = 0.15
            # Read filename
            if fname_len <= 256:
                fname_data = reader.read_at(offset + 30, fname_len)
                try:
                    fname = fname_data.decode("utf-8", errors="replace")
                    details.append(f"First file: {fname[:50]}")
                except Exception:
                    pass

        # Search for End of Central Directory
        read_size = min(50 * 1024 * 1024, reader.size - offset)
        # EOCD is in last 64 KB typically
        tail_size = min(65536, read_size)
        tail = reader.read_at(offset + read_size - tail_size, tail_size)
        estimated_size = 0

        eocd_sig = b"PK\x05\x06"
        eocd_pos = tail.rfind(eocd_sig)
        if eocd_pos != -1:
            factors["valid_end_central_dir"] = 0.20
            # EOCD is 22 bytes minimum
            estimated_size = read_size - tail_size + eocd_pos + 22
            # Read comment length if available
            if eocd_pos + 22 <= len(tail):
                comment_len = struct.unpack("<H", tail[eocd_pos + 20:eocd_pos + 22])[0]
                estimated_size += comment_len
            details.append("Found EOCD")

        # Search for central directory header
        if b"PK\x01\x02" in tail:
            factors["valid_central_dir"] = 0.25
            details.append("Found central directory")

        if estimated_size > 0:
            factors["reasonable_size"] = 0.15

        score = sum(factors.values())
        return ValidationResult(
            valid=score >= 0.40, format_name=format_name, offset=offset,
            estimated_size=estimated_size, confidence_score=score,
            confidence_factors=factors, details="; ".join(details),
        )


FormatValidator.register("zip", ZipValidator())
