"""
Tests for core.integrity.hashing — cryptographic hash utilities.
"""

import hashlib
from io import BytesIO

import pytest

from core.integrity.hashing import (
    hash_bytes, hash_file, hash_stream, SUPPORTED_ALGORITHMS,
)


class TestHashBytes:
    def test_sha256_known(self):
        result = hash_bytes(b"hello")
        expected = hashlib.sha256(b"hello").hexdigest()
        assert result["sha256"] == expected

    def test_md5(self):
        result = hash_bytes(b"hello", algorithms=["md5"])
        expected = hashlib.md5(b"hello").hexdigest()
        assert result["md5"] == expected

    def test_multiple_algorithms(self):
        result = hash_bytes(b"test", algorithms=["sha256", "md5", "sha1"])
        assert len(result) == 3
        assert result["sha256"] == hashlib.sha256(b"test").hexdigest()
        assert result["md5"] == hashlib.md5(b"test").hexdigest()
        assert result["sha1"] == hashlib.sha1(b"test").hexdigest()

    def test_empty_input(self):
        result = hash_bytes(b"")
        assert result["sha256"] == hashlib.sha256(b"").hexdigest()

    def test_unsupported_algorithm(self):
        with pytest.raises(ValueError, match="Unsupported"):
            hash_bytes(b"hello", algorithms=["sha512"])

    def test_default_is_sha256(self):
        result = hash_bytes(b"data")
        assert "sha256" in result
        assert len(result) == 1


class TestHashFile:
    def test_file_hash(self, tmp_dir):
        p = tmp_dir / "test.bin"
        content = b"file content for hashing"
        p.write_bytes(content)
        result = hash_file(p)
        expected = hashlib.sha256(content).hexdigest()
        assert result["sha256"] == expected

    def test_large_file(self, tmp_dir):
        p = tmp_dir / "large.bin"
        content = b"A" * (2 * 1024 * 1024)  # 2 MB
        p.write_bytes(content)
        result = hash_file(p, chunk_size=1024)
        expected = hashlib.sha256(content).hexdigest()
        assert result["sha256"] == expected

    def test_multiple_algos(self, tmp_dir):
        p = tmp_dir / "test.bin"
        p.write_bytes(b"multi")
        result = hash_file(p, algorithms=["sha256", "md5"])
        assert "sha256" in result
        assert "md5" in result


class TestHashStream:
    def test_stream(self):
        stream = BytesIO(b"stream data")
        result = hash_stream(stream)
        expected = hashlib.sha256(b"stream data").hexdigest()
        assert result["sha256"] == expected

    def test_stream_from_offset(self):
        stream = BytesIO(b"prefix_DATA")
        stream.seek(7)  # Skip "prefix_"
        result = hash_stream(stream)
        expected = hashlib.sha256(b"DATA").hexdigest()
        assert result["sha256"] == expected

    def test_empty_stream(self):
        stream = BytesIO(b"")
        result = hash_stream(stream)
        assert result["sha256"] == hashlib.sha256(b"").hexdigest()
