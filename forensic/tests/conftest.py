"""
Shared test fixtures for the forensic engine test suite.

Provides:
  - Temporary directories for test output
  - Synthetic test image creation
  - Pre-loaded format registry
  - Tiny valid test files for format-specific tests
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

import pytest


@pytest.fixture
def tmp_dir(tmp_path):
    """Provide a clean temporary directory for test output."""
    return tmp_path


@pytest.fixture
def registry():
    """Provide a fresh FormatRegistry with all built-in formats loaded.

    NOTE: This creates a NEW registry each time, separate from the
    global singleton, to avoid test contamination.
    """
    from core.detection.signatures import load_signatures
    return load_signatures()


# ---------------------------------------------------------------------------
# Synthetic test file builders
# ---------------------------------------------------------------------------

def create_tiny_jpeg(path: Path) -> Path:
    """Create the smallest valid JPEG file (a 1x1 white pixel).

    Structure: SOI + APP0 (JFIF) + DQT + SOF0 + DHT + SOS + image data + EOI
    This is a real, decodable JPEG — not just headers.
    """
    # Pre-built minimal JPEG (1x1 white pixel, ~285 bytes)
    # Generated once and hardcoded for deterministic tests.
    data = bytes.fromhex(
        "ffd8ffe000104a46494600010100000100010000"
        "ffdb004300080606070605080707070909080a0c"
        "140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c"
        "20242e2720222c231c1c2837292c30313434341f"
        "27393d38323c2e333432"
        "ffc0000b080001000101011100"
        "ffc4001f0000010501010101010100000000000000"
        "0001020304050607080910"  # Truncated DHT
        "ffda00080101000003f400"  # SOS
        "7b4028a0"
        "ffd9"
    )
    path.write_bytes(data)
    return path


def create_tiny_png(path: Path) -> Path:
    """Create a minimal valid PNG file (1x1 red pixel).

    Structure: PNG signature + IHDR + IDAT + IEND
    """
    signature = b"\x89PNG\x0D\x0A\x1A\x0A"

    # IHDR chunk: width=1, height=1, bit_depth=8, color_type=2 (RGB)
    ihdr_data = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b"IHDR" + ihdr_data) & 0xFFFFFFFF
    ihdr = struct.pack(">I", len(ihdr_data)) + b"IHDR" + ihdr_data + struct.pack(">I", ihdr_crc)

    # IDAT chunk: compressed pixel data (filter byte 0 + RGB red)
    raw_pixels = b"\x00\xFF\x00\x00"  # filter=None, R=255, G=0, B=0
    compressed = zlib.compress(raw_pixels)
    idat_crc = zlib.crc32(b"IDAT" + compressed) & 0xFFFFFFFF
    idat = struct.pack(">I", len(compressed)) + b"IDAT" + compressed + struct.pack(">I", idat_crc)

    # IEND chunk
    iend_crc = zlib.crc32(b"IEND") & 0xFFFFFFFF
    iend = struct.pack(">I", 0) + b"IEND" + struct.pack(">I", iend_crc)

    png_data = signature + ihdr + idat + iend
    path.write_bytes(png_data)
    return path


def create_raw_test_image(path: Path, size: int = 4096) -> Path:
    """Create a tiny raw disk image with embedded file signatures.

    The image contains:
    - JPEG signature at offset 512
    - PNG signature at offset 1024
    - PDF signature at offset 2048
    - Zero-filled elsewhere

    Useful for testing the scanner's ability to find signatures
    at known offsets.
    """
    data = bytearray(size)

    # JPEG SOI + APP0 marker at offset 512
    data[512:515] = b"\xFF\xD8\xFF"

    # PNG signature at offset 1024
    data[1024:1032] = b"\x89PNG\x0D\x0A\x1A\x0A"

    # PDF header at offset 2048
    data[2048:2053] = b"%PDF-"

    path.write_bytes(bytes(data))
    return path


def create_ewf_header_test_file(path: Path) -> Path:
    """Create a file that starts with the EWF signature.

    This is NOT a valid E01 file — it is only used to test
    detect_image_type() without needing a real EWF image.
    """
    ewf_sig = b"EVF\x09\x0d\x0a\xff\x00"
    path.write_bytes(ewf_sig + b"\x00" * 100)
    return path
