"""
Abstract base class for forensic image readers.

Architecture:
    Evidence File → ImageReader API (read/seek/tell/size) → forensic pipeline

The reader is strictly READ-ONLY.  It never modifies evidence.
"""
from __future__ import annotations
from abc import ABC, abstractmethod


class ImageReader(ABC):
    """Uniform byte-stream interface over any evidence format.

    Supports context manager::

        with open_image("evidence.E01") as reader:
            data = reader.read(4096)
    """

    @abstractmethod
    def open(self) -> None:
        """Open the evidence image for reading."""

    @abstractmethod
    def close(self) -> None:
        """Release resources."""

    @abstractmethod
    def read(self, size: int = -1) -> bytes:
        """Read up to *size* bytes.  Empty bytes at EOF."""

    @abstractmethod
    def seek(self, offset: int) -> None:
        """Seek to absolute byte offset."""

    @abstractmethod
    def tell(self) -> int:
        """Current byte offset."""

    @property
    @abstractmethod
    def size(self) -> int:
        """Total media size in bytes."""

    def __enter__(self) -> ImageReader:
        self.open()
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def read_at(self, offset: int, size: int) -> bytes:
        """Seek + read convenience."""
        self.seek(offset)
        return self.read(size)
