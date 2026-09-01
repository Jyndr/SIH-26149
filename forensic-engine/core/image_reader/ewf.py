"""
EWF/E01 image reader and image-type detection.

EWF (Expert Witness Format) stores disk images with compression,
segmentation (.E01/.E02/...), metadata, and CRC integrity checks.
pyewf handles the container; we expose raw media bytes.
"""
from __future__ import annotations
from pathlib import Path
from core.image_reader.base import ImageReader
from core.image_reader.raw import RawImageReader

EWF_SIGNATURE = b"EVF\x09\x0d\x0a\xff\x00"


class EwfImageReader(ImageReader):

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self._handle = None

    def open(self) -> None:
        try:
            import pyewf
        except ImportError as exc:
            raise RuntimeError(
                "E01 support requires pyewf. Install: pip install libewf-python"
            ) from exc
        filenames = pyewf.glob(str(self.path))
        if not filenames:
            raise RuntimeError(f"No EWF segments found for {self.path}")
        self._handle = pyewf.handle()
        self._handle.open(filenames)

    def close(self) -> None:
        if self._handle:
            self._handle.close()
            self._handle = None

    def read(self, size: int = -1) -> bytes:
        return self._handle.read(size)

    def seek(self, offset: int) -> None:
        self._handle.seek(offset)

    def tell(self) -> int:
        return self._handle.get_offset()

    @property
    def size(self) -> int:
        if self._handle is None:
            raise RuntimeError("Image not opened.")
        return self._handle.get_media_size()


def detect_image_type(path: str | Path) -> str:
    """Return 'ewf' or 'raw' based on file header."""
    with open(path, "rb") as f:
        header = f.read(len(EWF_SIGNATURE))
    return "ewf" if header == EWF_SIGNATURE else "raw"


def open_image(path: str | Path) -> ImageReader:
    """Factory: auto-detect and return the right reader (unopened)."""
    if detect_image_type(path) == "ewf":
        return EwfImageReader(path)
    return RawImageReader(path)
