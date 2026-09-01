"""Focused synthetic-volume tests for read-only NTFS metadata recovery."""
from __future__ import annotations

import struct

import pytest

from core.filesystem.ntfs import (
    NtfsBootSector,
    NtfsFormatError,
    apply_usa_fixups,
    decode_runlist,
    parse_ntfs,
    read_ntfs_file_content,
)
from core.filesystem import FileSystemAnalyzer
from core.image_reader.raw import RawImageReader
from core.partition import Partition


PARTITION_OFFSET = 4096
SECTOR_SIZE = 512
CLUSTER_SIZE = 512
RECORD_SIZE = 1024
MFT_RUNS = ((4, 12), (30, 12))
MFT_SIZE = 12 * RECORD_SIZE
FILETIME_2020 = 132223104000000000


def _align8(value: int) -> int:
    return (value + 7) & ~7


def _resident_attribute(type_code: int, value: bytes, attribute_id: int) -> bytes:
    value_offset = 24
    length = _align8(value_offset + len(value))
    result = bytearray(length)
    struct.pack_into("<IIBBHHH", result, 0, type_code, length, 0, 0, 0, 0, attribute_id)
    struct.pack_into("<IHB", result, 16, len(value), value_offset, 0)
    result[value_offset:value_offset + len(value)] = value
    return bytes(result)


def _nonresident_data_attribute(
    runlist: bytes,
    cluster_count: int,
    real_size: int,
    *,
    attribute_id: int,
    flags: int = 0,
    initialized_size: int | None = None,
) -> bytes:
    run_offset = 64
    length = _align8(run_offset + len(runlist))
    result = bytearray(length)
    struct.pack_into("<IIBBHHH", result, 0, 0x80, length, 1, 0, 0, flags, attribute_id)
    struct.pack_into("<QQ", result, 16, 0, cluster_count - 1)
    struct.pack_into("<HHI", result, 32, run_offset, 0, 0)
    struct.pack_into(
        "<QQQ",
        result,
        40,
        cluster_count * CLUSTER_SIZE,
        real_size,
        real_size if initialized_size is None else initialized_size,
    )
    result[run_offset:run_offset + len(runlist)] = runlist
    return bytes(result)


def _standard_information(*, file_attributes: int = 0x20) -> bytes:
    result = bytearray(48)
    struct.pack_into("<QQQQI", result, 0, *(FILETIME_2020,) * 4, file_attributes)
    return bytes(result)


def _file_name(
    name: str,
    *,
    parent: int = 5,
    parent_sequence: int = 1,
    real_size: int = 0,
    allocated_size: int = 0,
    directory: bool = False,
) -> bytes:
    encoded = name.encode("utf-16-le")
    result = bytearray(66 + len(encoded))
    parent_reference = parent | (parent_sequence << 48)
    struct.pack_into("<Q", result, 0, parent_reference)
    struct.pack_into("<QQQQ", result, 8, *(FILETIME_2020,) * 4)
    struct.pack_into("<QQ", result, 40, allocated_size, real_size)
    struct.pack_into("<I", result, 56, 0x10000000 if directory else 0x20)
    result[64] = len(name)
    result[65] = 1  # WIN32 namespace
    result[66:] = encoded
    return bytes(result)


def _file_record(
    number: int,
    attributes: list[bytes],
    *,
    in_use: bool = True,
    directory: bool = False,
    sequence: int = 1,
    corrupt_fixup: bool = False,
) -> bytes:
    result = bytearray(RECORD_SIZE)
    result[:4] = b"FILE"
    usa_offset = 0x30
    first_attribute = 0x38
    usa_count = RECORD_SIZE // SECTOR_SIZE + 1
    struct.pack_into("<HH", result, 4, usa_offset, usa_count)
    struct.pack_into("<H", result, 16, sequence)
    struct.pack_into("<H", result, 18, 1)
    struct.pack_into("<H", result, 20, first_attribute)
    flags = (1 if in_use else 0) | (2 if directory else 0)
    struct.pack_into("<H", result, 22, flags)
    struct.pack_into("<I", result, 28, RECORD_SIZE)
    struct.pack_into("<I", result, 44, number)

    position = first_attribute
    for attribute in attributes:
        result[position:position + len(attribute)] = attribute
        position += len(attribute)
    struct.pack_into("<I", result, position, 0xFFFFFFFF)
    bytes_in_use = _align8(position + 4)
    struct.pack_into("<I", result, 24, bytes_in_use)

    sequence_word = b"\xA5\x5A"
    original_trailers = []
    for sector in range(1, usa_count):
        trailer = sector * SECTOR_SIZE - 2
        original_trailers.append(bytes(result[trailer:trailer + 2]))
        result[trailer:trailer + 2] = sequence_word
    result[usa_offset:usa_offset + 2] = sequence_word
    for index, original in enumerate(original_trailers, start=1):
        result[usa_offset + index * 2:usa_offset + index * 2 + 2] = original
    if corrupt_fixup:
        result[RECORD_SIZE - 2:RECORD_SIZE] = b"XX"
    return bytes(result)


def _write_mft_record(image: bytearray, number: int, record: bytes) -> None:
    logical = number * RECORD_SIZE
    first_run_bytes = MFT_RUNS[0][1] * CLUSTER_SIZE
    if logical < first_run_bytes:
        lcn, _count = MFT_RUNS[0]
        physical = PARTITION_OFFSET + lcn * CLUSTER_SIZE + logical
    else:
        lcn, _count = MFT_RUNS[1]
        physical = PARTITION_OFFSET + lcn * CLUSTER_SIZE + logical - first_run_bytes
    image[physical:physical + RECORD_SIZE] = record


def _synthetic_ntfs_image(*, corrupt_deleted_record: bool = False) -> tuple[bytes, Partition]:
    partition_size = 64 * 1024
    image = bytearray(PARTITION_OFFSET + partition_size)
    boot = memoryview(image)[PARTITION_OFFSET:PARTITION_OFFSET + SECTOR_SIZE]
    boot[3:11] = b"NTFS    "
    struct.pack_into("<H", boot, 11, SECTOR_SIZE)
    boot[13] = 1
    struct.pack_into("<Q", boot, 40, partition_size // SECTOR_SIZE)
    struct.pack_into("<Q", boot, 48, MFT_RUNS[0][0])
    struct.pack_into("<Q", boot, 56, 2)
    struct.pack_into("<b", boot, 64, -10)  # 2**10-byte FILE records
    struct.pack_into("<b", boot, 68, -12)
    struct.pack_into("<Q", boot, 72, 0x123456789ABCDEF0)
    boot[510:512] = b"\x55\xAA"

    # $MFT is fragmented after record 5: LCN 4..15, then LCN 30..41.
    mft_runlist = b"\x11\x0c\x04\x11\x0c\x1a\x00"
    record0 = _file_record(
        0,
        [
            _resident_attribute(0x10, _standard_information(), 0),
            _resident_attribute(0x30, _file_name("$MFT"), 1),
            _nonresident_data_attribute(
                mft_runlist, 24, MFT_SIZE, attribute_id=2
            ),
        ],
    )
    root = _file_record(
        5,
        [
            _resident_attribute(0x10, _standard_information(file_attributes=0x10), 0),
            _resident_attribute(
                0x30,
                _file_name(".", parent=5, directory=True),
                1,
            ),
        ],
        directory=True,
    )

    # A 700-byte fragmented file at clusters 50 and 53.
    fragmented_runs = b"\x11\x01\x32\x11\x01\x03\x00"
    fragmented = _file_record(
        6,
        [
            _resident_attribute(0x10, _standard_information(), 0),
            _resident_attribute(
                0x30,
                _file_name(
                    "fragmented.bin",
                    real_size=700,
                    allocated_size=1024,
                ),
                1,
            ),
            _nonresident_data_attribute(
                fragmented_runs, 2, 700, attribute_id=2
            ),
        ],
    )
    deleted = _file_record(
        7,
        [
            _resident_attribute(0x10, _standard_information(), 0),
            _resident_attribute(
                0x30,
                _file_name("deleted.txt", real_size=7, allocated_size=7),
                1,
            ),
            _resident_attribute(0x80, b"deleted", 2),
        ],
        in_use=False,
        corrupt_fixup=corrupt_deleted_record,
    )

    # Physical cluster followed by one sparse cluster; only 188 sparse bytes
    # are part of the 700-byte logical file.
    sparse_runs = b"\x11\x01\x36\x01\x01\x00"
    sparse = _file_record(
        8,
        [
            _resident_attribute(0x10, _standard_information(), 0),
            _resident_attribute(
                0x30,
                _file_name("sparse.bin", real_size=700, allocated_size=512),
                1,
            ),
            _nonresident_data_attribute(
                sparse_runs, 2, 700, attribute_id=2, flags=0x8000
            ),
        ],
    )

    for number, record in ((0, record0), (5, root), (6, fragmented), (7, deleted), (8, sparse)):
        _write_mft_record(image, number, record)
    image[PARTITION_OFFSET + 50 * CLUSTER_SIZE:PARTITION_OFFSET + 51 * CLUSTER_SIZE] = b"A" * 512
    image[PARTITION_OFFSET + 53 * CLUSTER_SIZE:PARTITION_OFFSET + 54 * CLUSTER_SIZE] = b"B" * 512
    image[PARTITION_OFFSET + 54 * CLUSTER_SIZE:PARTITION_OFFSET + 55 * CLUSTER_SIZE] = b"S" * 512

    partition = Partition(1, PARTITION_OFFSET, partition_size, "0x07", "NTFS")
    return bytes(image), partition


def test_boot_sector_and_signed_fragmented_runlist_decoding():
    image, _partition = _synthetic_ntfs_image()
    boot = NtfsBootSector.parse(image[PARTITION_OFFSET:PARTITION_OFFSET + 512])
    assert boot.cluster_size == 512
    assert boot.file_record_size == 1024
    assert boot.volume_serial == 0x123456789ABCDEF0

    runs = decode_runlist(b"\x11\x03\x0a\x11\x02\xfd\x01\x04\x00")
    assert [(run.vcn, run.cluster_count, run.lcn) for run in runs] == [
        (0, 3, 10),
        (3, 2, 7),
        (5, 4, None),
    ]


def test_usa_fixup_rejects_a_torn_record():
    good = _file_record(9, [])
    assert apply_usa_fixups(good, SECTOR_SIZE)[:4] == b"FILE"
    torn = bytearray(good)
    torn[510:512] = b"NO"
    with pytest.raises(NtfsFormatError, match="update-sequence mismatch"):
        apply_usa_fixups(bytes(torn), SECTOR_SIZE)


def test_parses_fragmented_mft_paths_deleted_entries_and_timestamps(tmp_path):
    image, partition = _synthetic_ntfs_image()
    image_path = tmp_path / "synthetic-ntfs.img"
    image_path.write_bytes(image)

    with RawImageReader(image_path) as reader:
        entries = parse_ntfs(reader, partition)

    by_name = {entry["name"]: entry for entry in entries}
    assert {"$MFT", ".", "fragmented.bin", "deleted.txt", "sparse.bin"} <= set(by_name)
    fragmented = by_name["fragmented.bin"]
    assert fragmented["path"] == "/fragmented.bin"
    assert fragmented["size"] == 700
    assert fragmented["is_fragmented"] is True
    assert fragmented["is_complete"] is True
    assert fragmented["created_at"] == "2020-01-01T00:00:00Z"
    assert fragmented["extents"] == [
        {
            "image_offset": PARTITION_OFFSET + 50 * CLUSTER_SIZE,
            "logical_offset": 0,
            "length": 512,
            "sparse": False,
        },
        {
            "image_offset": PARTITION_OFFSET + 53 * CLUSTER_SIZE,
            "logical_offset": 512,
            "length": 188,
            "sparse": False,
        },
    ]

    deleted = by_name["deleted.txt"]
    assert deleted["is_deleted"] is True
    assert deleted["allocated"] is False
    assert deleted["resident_data"] == b"deleted"
    assert deleted["data_offset"] is not None
    assert deleted["path"] == "/deleted.txt"


def test_recovers_fragmented_resident_and_sparse_content(tmp_path):
    image, partition = _synthetic_ntfs_image()
    image_path = tmp_path / "synthetic-content.img"
    image_path.write_bytes(image)

    with RawImageReader(image_path) as reader:
        by_name = {entry["name"]: entry for entry in parse_ntfs(reader, partition)}
        assert read_ntfs_file_content(reader, by_name["fragmented.bin"]) == (
            b"A" * 512 + b"B" * 188
        )
        assert read_ntfs_file_content(reader, by_name["deleted.txt"]) == b"deleted"
        assert read_ntfs_file_content(reader, by_name["sparse.bin"]) == (
            b"S" * 512 + b"\x00" * 188
        )
        with pytest.raises(ValueError, match="max_bytes"):
            read_ntfs_file_content(reader, by_name["fragmented.bin"], max_bytes=699)


def test_corrupt_records_are_skipped_without_losing_other_metadata(tmp_path):
    image, partition = _synthetic_ntfs_image(corrupt_deleted_record=True)
    image_path = tmp_path / "synthetic-corrupt.img"
    image_path.write_bytes(image)

    with RawImageReader(image_path) as reader:
        entries = parse_ntfs(reader, partition)

    names = {entry["name"] for entry in entries}
    assert "deleted.txt" not in names
    assert {"fragmented.bin", "sparse.bin"} <= names


def test_corrupt_boot_and_unbounded_mapping_pairs_fail_closed(tmp_path):
    invalid_path = tmp_path / "not-ntfs.img"
    invalid_path.write_bytes(b"\x00" * 4096)
    partition = Partition(1, 0, 4096, "raw")
    with RawImageReader(invalid_path) as reader:
        assert parse_ntfs(reader, partition) == []

    with pytest.raises(NtfsFormatError):
        decode_runlist(b"\x18\xff\xff\xff\xff\xff\xff\xff\x7f\x01\x00", max_clusters=64)


def test_filesystem_analyzer_dispatches_ntfs_and_hides_resident_bytes(tmp_path):
    image, partition = _synthetic_ntfs_image()
    image_path = tmp_path / "synthetic-analyzer.img"
    image_path.write_bytes(image)

    with RawImageReader(image_path) as reader:
        info = FileSystemAnalyzer().analyze(reader, partition)

    assert info.type == "ntfs"
    assert info.metadata["boot_sector"]["file_record_size"] == RECORD_SIZE
    deleted = next(entry for entry in info.files if entry["name"] == "deleted.txt")
    assert "resident_data" not in deleted
    assert info.metadata["deleted_files_enumerated"] == 1
