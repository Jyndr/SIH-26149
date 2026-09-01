"""
Chunked signature scanner.

Reads an evidence image in configurable chunks, scanning for all
registered file signatures.  Correctly handles signatures that
cross chunk boundaries using an overlap buffer.

Output: list of SignatureCandidate — raw hits that need structural validation.
"""
from __future__ import annotations
from core.types import SignatureCandidate, Signature
from core.image_reader.base import ImageReader
from core.detection.registry import FormatRegistry

DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024  # 4 MiB


class ChunkedScanner:
    """Scan an evidence image for known file signatures.

    Usage::

        scanner = ChunkedScanner(registry)
        with open_image("evidence.img") as reader:
            candidates = scanner.scan(reader)
    """

    def __init__(self, registry: FormatRegistry, chunk_size: int = DEFAULT_CHUNK_SIZE):
        if chunk_size <= 0:
            raise ValueError("chunk_size must be positive")
        self.registry = registry
        self.chunk_size = chunk_size

    def scan(self, reader: ImageReader, progress_callback=None) -> list[SignatureCandidate]:
        """Scan the full image and return all signature candidates.

        Parameters
        ----------
        reader : ImageReader
            An opened evidence image reader.
        progress_callback : callable, optional
            Called with (bytes_processed, total_size) periodically.
        """
        # Scans always address the complete logical image, regardless of work
        # performed by earlier pipeline stages.
        reader.seek(0)
        # Build search table: deduplicate signatures.
        # RIFF appears in wav/avi/webp — scan "RIFF" once, classify later.
        sig_table: dict[bytes, list[tuple[str, Signature]]] = {}
        for fmt_name, sig in self.registry.get_all_signatures():
            sig_table.setdefault(sig.pattern, []).append((fmt_name, sig))

        all_patterns = list(sig_table.keys())
        max_sig_len = max(len(p) for p in all_patterns) if all_patterns else 0
        overlap = max(max_sig_len - 1, 0)

        candidates: list[SignatureCandidate] = []
        file_offset = 0
        prev_tail = b""
        total_size = reader.size

        while True:
            chunk = reader.read(self.chunk_size)
            if not chunk:
                break

            data = prev_tail + chunk
            search_base = file_offset - len(prev_tail)

            for pattern, fmt_list in sig_table.items():
                search_pos = 0
                while True:
                    found = data.find(pattern, search_pos)
                    if found == -1:
                        break

                    abs_offset = search_base + found

                    # Check offset requirements for each format using this pattern
                    for fmt_name, sig in fmt_list:
                        if sig.offset == 0:
                            # Pattern expected at file start — record as-is
                            candidates.append(SignatureCandidate(
                                offset=abs_offset,
                                format_name=fmt_name,
                                signature_hex=pattern.hex(" "),
                            ))
                        else:
                            # Pattern at non-zero offset (e.g. ftyp at offset 4).
                            # The candidate's file start is offset - sig.offset
                            file_start = abs_offset - sig.offset
                            if file_start >= 0:
                                candidates.append(SignatureCandidate(
                                    offset=file_start,
                                    format_name=fmt_name,
                                    signature_hex=pattern.hex(" "),
                                ))

                    search_pos = found + 1

            prev_tail = data[-overlap:] if overlap > 0 else b""
            file_offset += len(chunk)

            if progress_callback:
                progress_callback(file_offset, total_size)

        # Deduplicate: same (format_name, offset) pair
        seen = set()
        unique = []
        for c in candidates:
            key = (c.format_name, c.offset)
            if key not in seen:
                seen.add(key)
                unique.append(c)

        unique.sort(key=lambda c: c.offset)
        return unique
