from __future__ import annotations

import struct

from core.filesystem.exfat import ExFATLimits, ExFATParser, parse_exfat
from core.partition import Partition


class SparseReader:
    def __init__(self, size: int, regions: dict[int, bytes]) -> None:
        self._size = size
        self.regions = regions

    @property
    def size(self) -> int:
        return self._size

    def read_at(self, offset: int, size: int) -> bytes:
        if offset < 0 or size <= 0 or offset >= self._size:
            return b""
        size = min(size, self._size - offset)
        result = bytearray(size)
        end = offset + size
        for region_offset, data in self.regions.items():
            overlap_start = max(offset, region_offset)
            overlap_end = min(end, region_offset + len(data))
            if overlap_start < overlap_end:
                result[overlap_start - offset:overlap_end - offset] = data[
                    overlap_start - region_offset:overlap_end - region_offset
                ]
        return bytes(result)


def _checksum(records: list[bytearray]) -> int:
    checksum = 0
    for record_index, record in enumerate(records):
        for byte_index, value in enumerate(record):
            if record_index == 0 and byte_index in (2, 3):
                continue
            checksum = (((checksum << 15) | (checksum >> 1)) + value) & 0xFFFF
    return checksum


def _packed_time() -> int:
    date = ((2025 - 1980) << 9) | (6 << 5) | 7
    time = (8 << 11) | (9 << 5) | 5
    return (date << 16) | time


def _entry_set(
    name: str,
    first_cluster: int,
    data_length: int,
    *,
    valid_length: int | None = None,
    no_fat_chain: bool = True,
    directory: bool = False,
    deleted: bool = False,
) -> list[bytes]:
    encoded = name.encode("utf-16-le")
    name_chunks = [encoded[index:index + 30] for index in range(0, len(encoded), 30)]
    primary = bytearray(32)
    primary[0] = 0x85
    primary[1] = 1 + len(name_chunks)
    struct.pack_into("<H", primary, 4, 0x10 if directory else 0x20)
    timestamp = _packed_time()
    struct.pack_into("<I", primary, 8, timestamp)
    struct.pack_into("<I", primary, 12, timestamp)
    struct.pack_into("<I", primary, 16, timestamp)
    primary[20] = 50
    primary[21] = 0
    primary[22] = 0x84  # UTC+01:00
    primary[23] = 0x84
    primary[24] = 0x84

    stream = bytearray(32)
    stream[0] = 0xC0
    stream[1] = 0x02 if no_fat_chain else 0
    stream[3] = len(name)
    struct.pack_into("<Q", stream, 8, data_length if valid_length is None else valid_length)
    struct.pack_into("<I", stream, 20, first_cluster)
    struct.pack_into("<Q", stream, 24, data_length)

    names: list[bytearray] = []
    for chunk in name_chunks:
        entry = bytearray(32)
        entry[0] = 0xC1
        entry[2:2 + len(chunk)] = chunk
        names.append(entry)
    records = [primary, stream, *names]
    struct.pack_into("<H", primary, 2, _checksum(records))
    if deleted:
        for record in records:
            record[0] &= 0x7F
    return [bytes(record) for record in records]


def _exfat_reader(prefix: int = 2048) -> tuple[SparseReader, Partition]:
    sectors = 32
    boot = bytearray(512)
    boot[:3] = b"\xeb\x76\x90"
    boot[3:11] = b"EXFAT   "
    struct.pack_into("<Q", boot, 72, sectors)
    struct.pack_into("<I", boot, 80, 1)
    struct.pack_into("<I", boot, 84, 1)
    struct.pack_into("<I", boot, 88, 2)
    struct.pack_into("<I", boot, 92, 30)
    struct.pack_into("<I", boot, 96, 2)
    struct.pack_into("<I", boot, 100, 0x12345678)
    struct.pack_into("<H", boot, 104, 0x0100)
    boot[108] = 9
    boot[109] = 0
    boot[110] = 1
    boot[112] = 20
    boot[510:512] = b"\x55\xaa"

    fat = bytearray(512)
    struct.pack_into("<I", fat, 0, 0xFFFFFFF8)
    struct.pack_into("<I", fat, 4, 0xFFFFFFFF)
    struct.pack_into("<I", fat, 8, 0xFFFFFFFF)  # root cluster 2
    struct.pack_into("<I", fat, 8 * 4, 10)
    struct.pack_into("<I", fat, 10 * 4, 0xFFFFFFFF)

    root = bytearray(512)
    root_sets = [
        _entry_set("hello.txt", 3, 5),
        _entry_set("gone.bin", 4, 4, deleted=True),
        _entry_set("docs", 5, 512, directory=True),
        _entry_set("sparse.bin", 6, 600, valid_length=100),
        _entry_set("frag.dat", 8, 700, no_fat_chain=False),
    ]
    cursor = 0
    for entry_set in root_sets:
        for entry in entry_set:
            root[cursor:cursor + 32] = entry
            cursor += 32

    child = bytearray(512)
    cursor = 0
    for entry in _entry_set("inside.txt", 7, 3):
        child[cursor:cursor + 32] = entry
        cursor += 32

    heap = prefix + 2 * 512
    regions = {
        prefix: bytes(boot),
        prefix + 512: bytes(fat),
        heap: bytes(root),
        heap + 512: b"HELLO",
        heap + 2 * 512: b"GONE",
        heap + 3 * 512: bytes(child),
        heap + 4 * 512: b"S" * 100,
        heap + 5 * 512: b"IN!",
        heap + 6 * 512: b"A" * 512,
        heap + 8 * 512: b"B" * 188,
    }
    size = prefix + sectors * 512
    return SparseReader(size, regions), Partition(1, prefix, sectors * 512, "exfat")


def test_exfat_enumerates_live_deleted_nested_sparse_and_fragmented_files() -> None:
    reader, partition = _exfat_reader()
    parser = ExFATParser(reader, partition)

    entries = parser.enumerate_files()
    by_path = {entry["path"]: entry for entry in entries}

    assert set(by_path) == {
        "/hello.txt",
        "/gone.bin",
        "/docs",
        "/sparse.bin",
        "/frag.dat",
        "/docs/inside.txt",
    }
    hello = by_path["/hello.txt"]
    assert hello["offset"] == partition.start_offset + 3 * 512
    assert hello["timestamps"]["created"] == "2025-06-07T08:09:10.500000+01:00"
    assert hello["metadata"]["entry_set_checksum_valid"] is True

    deleted = by_path["/gone.bin"]
    assert deleted["is_deleted"] is True
    assert deleted["metadata"]["entry_set_checksum_valid"] is True
    assert deleted["name"] == "gone.bin"

    sparse = by_path["/sparse.bin"]
    assert sparse["is_complete"] is True
    assert sparse["extents"][-1] == {
        "image_offset": None,
        "logical_offset": 100,
        "length": 500,
        "sparse": True,
    }

    fragmented = by_path["/frag.dat"]
    assert fragmented["cluster_chain"] == [8, 10]
    assert fragmented["is_fragmented"] is True
    assert [extent["length"] for extent in fragmented["extents"]] == [512, 188]
    assert by_path["/docs/inside.txt"]["parent_path"] == "/docs"


def test_exfat_bounds_corrupt_entry_sets_and_invalid_geometry() -> None:
    reader, partition = _exfat_reader()
    # A very small caller-selected result bound terminates enumeration safely.
    entries = ExFATParser(
        reader, partition, limits=ExFATLimits(max_entries=2)
    ).enumerate_files()
    assert len(entries) == 2

    invalid = SparseReader(4096, {0: b"not exfat"})
    assert parse_exfat(invalid, Partition(1, 0, 4096, "raw")) == []


def test_exfat_invalid_entry_checksum_is_not_claimed_complete() -> None:
    reader, partition = _exfat_reader()
    root_offset = partition.start_offset + 2 * 512
    root = bytearray(reader.regions[root_offset])
    root[2] ^= 0x01
    reader.regions[root_offset] = bytes(root)

    hello = next(entry for entry in parse_exfat(reader, partition)
                 if entry["path"] == "/hello.txt")

    assert hello["metadata"]["entry_set_checksum_valid"] is False
    assert hello["is_complete"] is False
