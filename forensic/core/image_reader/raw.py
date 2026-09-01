"""
Raw (dd-style) disk image reader.

A raw image is a byte-for-byte copy of a storage device.
Byte n in the file = byte n on the original device.
"""
from __future__ import annotations
import os
from pathlib import Path
from core.image_reader.base import ImageReader


class RawImageReader(ImageReader):

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self._file = None
        self._size: int | None = None

    def open(self) -> None:
        self._file = self.path.open("rb")
        self._size = os.path.getsize(self.path)

    def close(self) -> None:
        if self._file:
            self._file.close()
            self._file = None

    def read(self, size: int = -1) -> bytes:
        if self._file is None:
            raise RuntimeError("Image not opened.")
        return self._file.read(size)

    def seek(self, offset: int) -> None:
        if self._file is None:
            raise RuntimeError("Image not opened.")
        if offset < 0:
            raise ValueError("offset must not be negative")
        self._file.seek(offset)

    def tell(self) -> int:
        if self._file is None:
            raise RuntimeError("Image not opened.")
        return self._file.tell()

    @property
    def size(self) -> int:
        if self._size is None:
            raise RuntimeError("Image not opened. Call open() or use context manager.")
        return self._size
