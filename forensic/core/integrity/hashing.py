"""Bounded-memory cryptographic hashing utilities."""
from __future__ import annotations
import hashlib
from pathlib import Path
from typing import BinaryIO
from core.image_reader.base import ImageReader

SUPPORTED_ALGORITHMS = ("sha256", "sha1", "md5")
DEFAULT_CHUNK_SIZE = 1024 * 1024


def _hashers(algorithms: list[str] | None) -> dict[str, object]:
    names = algorithms or ["sha256"]
    unsupported = set(names) - set(SUPPORTED_ALGORITHMS)
    if unsupported:
        raise ValueError(f"Unsupported hash algorithm(s): {', '.join(sorted(unsupported))}")
    return {name: hashlib.new(name) for name in names}


def hash_stream(stream: BinaryIO, algorithms: list[str] | None = None,
                chunk_size: int = DEFAULT_CHUNK_SIZE) -> dict[str, str]:
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    hashers = _hashers(algorithms)
    while chunk := stream.read(chunk_size):
        for hasher in hashers.values():
            hasher.update(chunk)
    return {name: hasher.hexdigest() for name, hasher in hashers.items()}


def hash_file(path: str | Path, algorithms: list[str] | None = None,
              chunk_size: int = DEFAULT_CHUNK_SIZE) -> dict[str, str]:
    with Path(path).open("rb") as stream:
        return hash_stream(stream, algorithms, chunk_size)


def hash_bytes(data: bytes, algorithms: list[str] | None = None) -> dict[str, str]:
    hashers = _hashers(algorithms)
    for hasher in hashers.values():
        hasher.update(data)
    return {name: hasher.hexdigest() for name, hasher in hashers.items()}


def hash_reader(reader: ImageReader, algorithms: list[str] | None = None,
                chunk_size: int = DEFAULT_CHUNK_SIZE) -> dict[str, str]:
    """Hash logical evidence bytes while restoring the reader position."""
    position = reader.tell()
    try:
        reader.seek(0)
        return hash_stream(reader, algorithms, chunk_size)  # type: ignore[arg-type]
    finally:
        reader.seek(position)
