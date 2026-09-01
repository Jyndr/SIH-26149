"""
Tests for core.image_reader — evidence image readers.
"""

import pytest
from core.image_reader import (
    ImageReader, RawImageReader, EwfImageReader,
    detect_image_type, open_image,
)
from conftest import create_raw_test_image, create_ewf_header_test_file


class TestRawImageReader:
    def test_open_read(self, tmp_dir):
        p = tmp_dir / "t.img"
        p.write_bytes(b"hello world" + b"\x00" * 100)
        with RawImageReader(p) as r:
            assert r.read(5) == b"hello"

    def test_seek_tell(self, tmp_dir):
        p = tmp_dir / "t.img"
        p.write_bytes(b"ABCDEFGHIJ")
        with RawImageReader(p) as r:
            r.seek(5)
            assert r.tell() == 5
            assert r.read(3) == b"FGH"

    def test_size(self, tmp_dir):
        p = tmp_dir / "t.img"
        p.write_bytes(b"\x00" * 4096)
        with RawImageReader(p) as r:
            assert r.size == 4096

    def test_size_before_open(self, tmp_dir):
        p = tmp_dir / "t.img"
        p.write_bytes(b"\x00")
        r = RawImageReader(p)
        with pytest.raises(RuntimeError):
            _ = r.size

    def test_read_at(self, tmp_dir):
        p = tmp_dir / "t.img"
        p.write_bytes(b"0123456789")
        with RawImageReader(p) as r:
            assert r.read_at(3, 4) == b"3456"

    def test_is_subclass(self):
        assert issubclass(RawImageReader, ImageReader)

    def test_not_found(self, tmp_dir):
        r = RawImageReader(tmp_dir / "nope.img")
        with pytest.raises(FileNotFoundError):
            r.open()


class TestDetectImageType:
    def test_raw(self, tmp_dir):
        p = tmp_dir / "t.img"
        p.write_bytes(b"\x00" * 512)
        assert detect_image_type(p) == "raw"

    def test_ewf(self, tmp_dir):
        p = tmp_dir / "t.E01"
        create_ewf_header_test_file(p)
        assert detect_image_type(p) == "ewf"


class TestOpenImage:
    def test_raw(self, tmp_dir):
        p = tmp_dir / "t.img"
        p.write_bytes(b"\x00" * 100)
        assert isinstance(open_image(p), RawImageReader)

    def test_ewf(self, tmp_dir):
        p = tmp_dir / "t.E01"
        create_ewf_header_test_file(p)
        assert isinstance(open_image(p), EwfImageReader)


class TestSignaturesInImage:
    def test_find_embedded(self, tmp_dir):
        p = tmp_dir / "t.img"
        create_raw_test_image(p, size=4096)
        with RawImageReader(p) as r:
            assert r.read_at(512, 3) == b"\xFF\xD8\xFF"
            assert r.read_at(1024, 8) == b"\x89PNG\x0D\x0A\x1A\x0A"
            assert r.read_at(2048, 5) == b"%PDF-"
