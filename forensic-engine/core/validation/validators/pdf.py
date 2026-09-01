"""
PDF structural validator.

Checks: %PDF- header with version, searches for %%EOF,
looks for xref/startxref, validates reasonable structure.
"""
from core.types import ValidationResult
from core.image_reader.base import ImageReader
from core.validation.validator import FormatValidator

_READ_LIMIT = 50 * 1024 * 1024


class PdfValidator(FormatValidator):

    def validate(self, reader: ImageReader, offset: int, format_name: str) -> ValidationResult:
        factors = {}
        details = []

        header = reader.read_at(offset, 20)
        if len(header) < 8:
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Not enough data")

        if not header.startswith(b"%PDF-"):
            return ValidationResult(valid=False, format_name=format_name, offset=offset,
                                    error="Missing %PDF- header")
        factors["valid_header"] = 0.20

        # Version check
        try:
            ver_end = header.index(b"\n", 5) if b"\n" in header[5:] else header.index(b"\r", 5)
            version = header[5:ver_end].decode("ascii", errors="ignore").strip()
            if version and version[0].isdigit():
                factors["valid_version"] = 0.10
                details.append(f"PDF version: {version}")
        except (ValueError, IndexError):
            pass

        # Read a chunk from the end to find %%EOF
        read_size = min(_READ_LIMIT, reader.size - offset)
        # Read last 4 KB first (%%EOF is near the end)
        tail_size = min(4096, read_size)
        tail = reader.read_at(offset + read_size - tail_size, tail_size)

        estimated_size = 0
        if b"%%EOF" in tail:
            eof_pos = tail.rfind(b"%%EOF")
            estimated_size = read_size - tail_size + eof_pos + 5
            factors["valid_eof"] = 0.20
            details.append("Found %%EOF")

        # Look for xref or startxref
        if b"startxref" in tail:
            factors["valid_xref"] = 0.15
            details.append("Found startxref")
        elif b"xref" in tail:
            factors["valid_xref"] = 0.10
            details.append("Found xref")

        # Check for obj/endobj in first chunk
        first_chunk = reader.read_at(offset, min(read_size, 8192))
        if b" obj" in first_chunk or b" 0 obj" in first_chunk:
            factors["valid_objects"] = 0.20
            details.append("Found PDF objects")

        if estimated_size > 0 and estimated_size <= 2 * 1024 * 1024 * 1024:
            factors["reasonable_size"] = 0.15

        score = sum(factors.values())
        return ValidationResult(
            valid=score >= 0.40, format_name=format_name, offset=offset,
            estimated_size=estimated_size, confidence_score=score,
            confidence_factors=factors, details="; ".join(details),
        )


FormatValidator.register("pdf", PdfValidator())
