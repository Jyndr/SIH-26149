"""
EWF/E01 image reader and image-type detection.

Supports EWF (Expert Witness Format) disk images. Uses pyewf when available,
and includes a built-in zero-dependency PurePythonEwfReader that decompresses
zlib chunk tables with LRU memory caching.
"""
from __future__ import annotations

from collections import OrderedDict
from pathlib import Path
import struct
import zlib

from core.image_reader.base import ImageReader
from core.image_reader.raw import RawImageReader

EWF_SIGNATURE = b"EVF\x09\x0d\x0a\xff\x00"


class PurePythonEwfReader(ImageReader):
    """Pure-Python read-only reader for E01 (Expert Witness Format) images."""

    def __init__(self, path: str | Path, max_cache_chunks: int = 128) -> None:
        self.path = Path(path)
        self._file = None
        self._chunks: list[tuple[int, int, bool]] = []
        self._chunk_size: int = 32768
        self._media_size: int = 0
        self._pos: int = 0
        self._cache: OrderedDict[int, bytes] = OrderedDict()
        self._max_cache: int = max_cache_chunks

    def open(self) -> None:
        if not self.path.is_file():
            raise FileNotFoundError(f"Evidence file not found: {self.path}")

        self._file = open(self.path, "rb")
        sig = self._file.read(13)
        if not sig.startswith(EWF_SIGNATURE):
            raise ValueError(f"File is not a valid EWF/E01 image: {self.path}")

        pos = 13
        tables: list[tuple[int, list[int], int]] = []
        while pos > 0:
            self._file.seek(pos)
            hdr = self._file.read(76)
            if len(hdr) < 32:
                break
            stype = hdr[:16].rstrip(b"\x00").decode("ascii", errors="replace")
            next_off = struct.unpack("<Q", hdr[16:24])[0]
            size = struct.unpack("<Q", hdr[24:32])[0]

            if stype == "disk":
                ddata = self._file.read(min(size - 76, 1024))
                if len(ddata) >= 16:
                    spc = struct.unpack("<I", ddata[8:12])[0]
                    bps = struct.unpack("<I", ddata[12:16])[0]
                    tot_sec = (
                        struct.unpack("<Q", ddata[16:24])[0]
                        if len(ddata) >= 24
                        else struct.unpack("<I", ddata[16:20])[0]
                    )
                    self._chunk_size = spc * bps
                    self._media_size = tot_sec * bps
            elif stype == "table":
                thdr = self._file.read(24)
                if len(thdr) >= 16:
                    ccount, _pad, base_off = struct.unpack("<IIQ", thdr[:16])
                    raw_entries = [
                        struct.unpack("<I", self._file.read(4))[0]
                        for _ in range(ccount)
                    ]
                    # The end of chunk data for this table is pos (table section start)
                    tables.append((base_off, raw_entries, pos))

            if stype in ("done", "next") or next_off == 0:
                break
            pos = next_off

        self._chunks.clear()
        for base_off, raw_entries, table_pos in tables:
            for i in range(len(raw_entries) - 1):
                e_cur = raw_entries[i]
                e_nxt = raw_entries[i + 1]
                o_cur = base_off + (e_cur & 0x7FFFFFFF)
                o_nxt = base_off + (e_nxt & 0x7FFFFFFF)
                self._chunks.append((o_cur, o_nxt - o_cur, bool(e_cur & 0x80000000)))
            if raw_entries:
                e_cur = raw_entries[-1]
                o_cur = base_off + (e_cur & 0x7FFFFFFF)
                self._chunks.append(
                    (o_cur, table_pos - o_cur, bool(e_cur & 0x80000000))
                )

        if not self._media_size and self._chunks:
            self._media_size = len(self._chunks) * self._chunk_size

    def close(self) -> None:
        if self._file:
            self._file.close()
            self._file = None
        self._cache.clear()

    def seek(self, offset: int) -> None:
        if offset < 0:
            raise ValueError(f"Negative seek offset: {offset}")
        self._pos = min(offset, self._media_size)

    def tell(self) -> int:
        return self._pos

    @property
    def size(self) -> int:
        return self._media_size

    def _get_chunk(self, idx: int) -> bytes:
        if idx in self._cache:
            self._cache.move_to_end(idx)
            return self._cache[idx]

        if idx >= len(self._chunks):
            return b"\x00" * self._chunk_size

        off, clen, is_comp = self._chunks[idx]
        self._file.seek(off)
        raw = self._file.read(clen)

        if is_comp:
            try:
                data = zlib.decompress(raw)
            except Exception:
                data = raw
        else:
            data = raw

        if len(data) < self._chunk_size:
            data = data + b"\x00" * (self._chunk_size - len(data))

        self._cache[idx] = data
        if len(self._cache) > self._max_cache:
            self._cache.popitem(last=False)
        return data

    def read(self, size: int = -1) -> bytes:
        if size == -1 or self._pos + size > self._media_size:
            size = self._media_size - self._pos
        if size <= 0:
            return b""

        res = bytearray()
        while size > 0:
            c_idx = self._pos // self._chunk_size
            c_off = self._pos % self._chunk_size
            chunk = self._get_chunk(c_idx)
            take = min(size, self._chunk_size - c_off)
            res.extend(chunk[c_off : c_off + take])
            self._pos += take
            size -= take

        return bytes(res)


class EwfImageReader(ImageReader):
    """Wrapper that tries pyewf and falls back to PurePythonEwfReader."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self._impl: ImageReader | None = None

    def open(self) -> None:
        # Try native pyewf first
        try:
            import pyewf
            filenames = pyewf.glob(str(self.path))
            if filenames:
                handle = pyewf.handle()
                handle.open(filenames)
                self._impl = _PyEwfWrapper(handle)
                return
        except Exception:
            pass

        # Pure python fallback
        pure_reader = PurePythonEwfReader(self.path)
        pure_reader.open()
        self._impl = pure_reader

    def close(self) -> None:
        if self._impl:
            self._impl.close()
            self._impl = None

    def read(self, size: int = -1) -> bytes:
        if not self._impl:
            raise RuntimeError("Image not opened.")
        return self._impl.read(size)

    def seek(self, offset: int) -> None:
        if not self._impl:
            raise RuntimeError("Image not opened.")
        self._impl.seek(offset)

    def tell(self) -> int:
        if not self._impl:
            raise RuntimeError("Image not opened.")
        return self._impl.tell()

    @property
    def size(self) -> int:
        if not self._impl:
            raise RuntimeError("Image not opened.")
        return self._impl.size


class _PyEwfWrapper(ImageReader):
    """Helper wrapper around pyewf handle."""

    def __init__(self, handle) -> None:
        self._handle = handle

    def open(self) -> None:
        pass

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
