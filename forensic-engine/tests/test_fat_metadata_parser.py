from __future__ import annotations

import struct

import pytest

from core.filesystem.fat import FATLimits, FATParser, parse_fat
from core.filesystem import FileSystemAnalyzer
from core.partition import Partition


class SparseReader:
    """Tiny sparse ImageReader-shaped object for large synthetic FAT geometry."""

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
        read_end = offset + size
        for region_offset, data in self.regions.items():
            region_end = region_offset + len(data)
            overlap_start = max(offset, region_offset)
            overlap_end = min(read_end, region_end)
            if overlap_start < overlap_end:
                result[overlap_start - offset:overlap_end - offset] = data[
                    overlap_start - region_offset:overlap_end - region_offset
                ]
        return bytes(result)


def _set_fat12(table: bytearray, cluster: int, value: int) -> None:
    offset = cluster + cluster // 2
    if cluster & 1:
        table[offset] = (table[offset] & 0x0F) | ((value << 4) & 0xF0)
        table[offset + 1] = (value >> 4) & 0xFF
    else:
        table[offset] = value & 0xFF
        table[offset + 1] = (table[offset + 1] & 0xF0) | ((value >> 8) & 0x0F)


def _short_checksum(short_name: bytes) -> int:
    checksum = 0
    for value in short_name:
        checksum = (((checksum & 1) << 7) | (checksum >> 1)) + value
        checksum &= 0xFF
    return checksum


def _lfn_entries(name: str, short_name: bytes, *, deleted: bool = False) -> list[bytes]:
    encoded = name.encode("utf-16-le")
    units = [encoded[index:index + 2] for index in range(0, len(encoded), 2)]
    if len(units) % 13:
        units.append(b"\0\0")
        units.extend([b"\xff\xff"] * ((-len(units)) % 13))
    checksum = _short_checksum(short_name)
    logical: list[bytearray] = []
    for index in range(0, len(units), 13):
        part = b"".join(units[index:index + 13])
        entry = bytearray(32)
        ordinal = index // 13 + 1
        entry[0] = ordinal
        entry[11] = 0x0F
        entry[13] = checksum
        entry[1:11] = part[:10]
        entry[14:26] = part[10:22]
        entry[28:32] = part[22:26]
        logical.append(entry)
    logical[-1][0] |= 0x40
    physical = list(reversed(logical))
    if deleted:
        for entry in physical:
            entry[0] = 0xE5
    return [bytes(entry) for entry in physical]


def _directory_entry(
    short_name: bytes,
    cluster: int,
    size: int,
    *,
    deleted: bool = False,
) -> bytes:
    entry = bytearray(32)
    entry[:11] = short_name
    if deleted:
        entry[0] = 0xE5
    entry[11] = 0x20
    entry[13] = 50
    date = ((2024 - 1980) << 9) | (1 << 5) | 2
    time = (3 << 11) | (4 << 5) | 3
    struct.pack_into("<H", entry, 14, time)
    struct.pack_into("<H", entry, 16, date)
    struct.pack_into("<H", entry, 18, date)
    struct.pack_into("<H", entry, 22, time)
    struct.pack_into("<H", entry, 24, date)
    struct.pack_into("<H", entry, 26, cluster)
    struct.pack_into("<I", entry, 28, size)
    return bytes(entry)


def _fat12_reader(prefix: int = 4096) -> tuple[SparseReader, Partition]:
    sectors = 16
    boot = bytearray(512)
    boot[:3] = b"\xeb\x3c\x90"
    boot[3:11] = b"MSDOS5.0"
    struct.pack_into("<H", boot, 11, 512)
    boot[13] = 1
    struct.pack_into("<H", boot, 14, 1)
    boot[16] = 1
    struct.pack_into("<H", boot, 17, 16)
    struct.pack_into("<H", boot, 19, sectors)
    boot[21] = 0xF8
    struct.pack_into("<H", boot, 22, 1)
    boot[510:512] = b"\x55\xaa"

    fat = bytearray(512)
    _set_fat12(fat, 0, 0xFF8)
    _set_fat12(fat, 1, 0xFFF)
    _set_fat12(fat, 2, 0xFFF)

    root = bytearray(512)
    live_short = b"LONGNA~1TXT"
    cursor = 0
    for entry in _lfn_entries("Long Name.txt", live_short):
        root[cursor:cursor + 32] = entry
        cursor += 32
    root[cursor:cursor + 32] = _directory_entry(live_short, 2, 5)
    cursor += 32
    root[cursor:cursor + 32] = _directory_entry(
        b"DEL     BIN", 3, 700, deleted=True
    )
    cursor += 32

    deleted_short = b"SECRET~1DOC"
    for entry in _lfn_entries("Secret Plan.doc", deleted_short, deleted=True):
        root[cursor:cursor + 32] = entry
        cursor += 32
    root[cursor:cursor + 32] = _directory_entry(
        deleted_short, 5, 4, deleted=True
    )

    data_offset = prefix + 3 * 512
    regions = {
        prefix: bytes(boot),
        prefix + 512: bytes(fat),
        prefix + 1024: bytes(root),
        data_offset: b"HELLO",
        data_offset + 512: b"D" * 512,
        data_offset + 1024: b"E" * 188,
        data_offset + 1536: b"PLAN",
    }
    size = prefix + sectors * 512
    return SparseReader(size, regions), Partition(1, prefix, sectors * 512, "fat")


def test_fat12_enumerates_lfn_timestamps_and_deleted_recovery_extents() -> None:
    reader, partition = _fat12_reader()
    parser = FATParser(reader, partition)

    entries = parser.enumerate_files()
    by_path = {entry["path"]: entry for entry in entries}

    assert parser.volume.variant == "fat12"
    assert by_path["/Long Name.txt"]["timestamps"]["created"] == (
        "2024-01-02T03:04:06.500000"
    )
    assert by_path["/Long Name.txt"]["extents"] == [
        {
            "image_offset": partition.start_offset + 3 * 512,
            "logical_offset": 0,
            "length": 5,
            "sparse": False,
        }
    ]
    deleted = by_path["/?EL.BIN"]
    assert deleted["is_deleted"] is True
    assert deleted["cluster_chain"] == [3, 4]
    assert deleted["metadata"]["chain_source"] == "contiguous_inference"
    assert deleted["is_complete"] is False
    assert deleted["extents"][0]["length"] == 700
    assert by_path["/Secret Plan.doc"]["metadata"]["long_name_valid"] is True
    assert by_path["/Secret Plan.doc"]["is_deleted"] is True


@pytest.mark.parametrize(
    ("expected_variant", "total_sectors", "fat_sectors", "root_entries"),
    [
        ("fat16", 5_000, 20, 16),
        # Widely produced small FAT32 layout below the recommended cluster
        # threshold remains structurally unambiguous in its BPB.
        ("fat32", 64_000, 504, 0),
        ("fat32", 66_050, 520, 0),
    ],
)
def test_fat_variant_geometry_and_root_enumeration(
    expected_variant: str,
    total_sectors: int,
    fat_sectors: int,
    root_entries: int,
) -> None:
    boot = bytearray(512)
    boot[:3] = b"\xeb\x58\x90"
    boot[3:11] = b"MSDOS5.0"
    struct.pack_into("<H", boot, 11, 512)
    boot[13] = 1
    struct.pack_into("<H", boot, 14, 1)
    boot[16] = 1
    struct.pack_into("<H", boot, 17, root_entries)
    boot[21] = 0xF8
    if expected_variant == "fat16":
        struct.pack_into("<H", boot, 19, total_sectors)
        struct.pack_into("<H", boot, 22, fat_sectors)
        root_sector = 1 + fat_sectors
    else:
        struct.pack_into("<I", boot, 32, total_sectors)
        struct.pack_into("<I", boot, 36, fat_sectors)
        struct.pack_into("<I", boot, 44, 2)
        root_sector = 1 + fat_sectors
    boot[510:512] = b"\x55\xaa"

    fat = bytearray(fat_sectors * 512)
    if expected_variant == "fat16":
        struct.pack_into("<H", fat, 0, 0xFFF8)
        struct.pack_into("<H", fat, 2, 0xFFFF)
        struct.pack_into("<H", fat, 4, 0xFFFF)
    else:
        struct.pack_into("<I", fat, 0, 0x0FFFFFF8)
        struct.pack_into("<I", fat, 4, 0xFFFFFFFF)
        struct.pack_into("<I", fat, 8, 0x0FFFFFFF)
        struct.pack_into("<I", fat, 12, 0x0FFFFFFF)

    root = bytearray(512)
    root[:32] = _directory_entry(b"ONE     TXT", 3 if expected_variant == "fat32" else 2, 1)
    start = 2048
    reader = SparseReader(
        start + total_sectors * 512,
        {
            start: bytes(boot),
            start + 512: bytes(fat),
            start + root_sector * 512: bytes(root),
        },
    )
    partition = Partition(1, start, total_sectors * 512, "fat")
    parser = FATParser(reader, partition)

    assert parser.volume.variant == expected_variant
    assert [entry["path"] for entry in parser.enumerate_files()] == ["/ONE.TXT"]


def test_fat_corruption_limits_and_plugin_failure_are_safe() -> None:
    reader, partition = _fat12_reader()
    entries = FATParser(
        reader, partition, limits=FATLimits(max_entries=1)
    ).enumerate_files()
    assert len(entries) == 1

    invalid = SparseReader(4096, {0: b"not a filesystem"})
    assert parse_fat(invalid, Partition(1, 0, 4096, "raw")) == []


def test_filesystem_analyzer_dispatches_unlabelled_fat_parser() -> None:
    reader, partition = _fat12_reader()

    info = FileSystemAnalyzer().analyze(reader, partition)

    assert info.type == "fat12"
    assert any(entry["path"] == "/Long Name.txt" for entry in info.entries)
    assert info.metadata["volume"]["variant"] == "fat12"
    assert info.metadata["files_enumerated"] == 3
