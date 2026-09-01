from pathlib import Path

from core.detection.signatures import load_signatures
from core.filesystem.recovery import FileSystemRecoverer, public_filesystem_entry
from core.filesystem import FileSystemAnalyzer
from core.image_reader import RawImageReader
from core.partition import Partition, PartitionAnalyzer


def _recover(tmp_path, image: bytes, entries, **kwargs):
    evidence = tmp_path / "disk.img"
    evidence.write_bytes(image)
    partition = Partition(1, 0, len(image), "raw")
    recoverer = FileSystemRecoverer(
        load_signatures(), max_file_size=kwargs.get("max_file_size", 1024),
        chunk_size=3, recover_deleted=kwargs.get("recover_deleted", True))
    with RawImageReader(evidence) as reader:
        return recoverer.recover(reader, partition, "testfs", entries,
                                 tmp_path / "out", "CASE-FS")


def test_recovers_fragmented_file_from_absolute_extents(tmp_path):
    image = bytearray(512)
    image[100:104] = b"ABCD"
    image[300:304] = b"EFGH"
    entry = {
        "name": "fragmented.txt", "path": "/fragmented.txt", "size": 8,
        "allocated": True, "is_complete": True,
        "extents": [
            {"logical_offset": 0, "image_offset": 100, "length": 4},
            {"logical_offset": 4, "image_offset": 300, "length": 4},
        ],
        "timestamps": {"modified": "2024-01-01T00:00:00+00:00"},
    }

    result = _recover(tmp_path, bytes(image), [entry])

    assert result.failed == 0
    assert len(result.artifacts) == 1
    artifact = result.artifacts[0]
    assert Path(artifact.output_path).read_bytes() == b"ABCDEFGH"
    assert artifact.recovery_method == "filesystem"
    assert artifact.is_complete
    assert artifact.is_fragmented
    assert artifact.metadata["original_path"] == "/fragmented.txt"
    assert artifact.sha256


def test_recovers_resident_and_sparse_files(tmp_path):
    image = bytearray(256)
    image[128:132] = b"tail"
    entries = [
        {"name": "resident.bin", "size": 4, "resident_data": b"data",
         "allocated": True},
        {"name": "sparse.bin", "size": 8, "allocated": True,
         "extents": [
             {"logical_offset": 0, "image_offset": None, "length": 4,
              "sparse": True},
             {"logical_offset": 4, "image_offset": 128, "length": 4},
         ]},
    ]

    result = _recover(tmp_path, bytes(image), entries)

    assert len(result.artifacts) == 2
    recovered = {artifact.metadata["original_name"]:
                 Path(artifact.output_path).read_bytes() for artifact in result.artifacts}
    assert recovered["resident.bin"] == b"data"
    assert recovered["sparse.bin"] == b"\0\0\0\0tail"
    assert public_filesystem_entry(entries[0]).get("resident_data") is None


def test_deleted_filter_and_size_limit_are_reported(tmp_path):
    entries = [
        {"name": "deleted.bin", "size": 1, "is_deleted": True,
         "extents": [{"image_offset": 0, "length": 1}]},
        {"name": "large.bin", "size": 20, "allocated": True,
         "extents": [{"image_offset": 0, "length": 20}]},
    ]

    result = _recover(tmp_path, b"x" * 32, entries, max_file_size=10,
                      recover_deleted=False)

    assert not result.artifacts
    assert result.detected == 2
    assert result.skipped == 2
    assert any("exceeds configured recovery limit" in warning
               for warning in result.warnings)


def test_out_of_partition_extent_produces_partial_artifact(tmp_path):
    entry = {
        "name": "damaged.bin", "size": 8, "allocated": True,
        "extents": [
            {"logical_offset": 0, "image_offset": 4, "length": 4},
            {"logical_offset": 4, "image_offset": 1000, "length": 4},
        ],
    }

    result = _recover(tmp_path, b"xxxxGOODxxxxxxxx", [entry])

    assert len(result.artifacts) == 1
    artifact = result.artifacts[0]
    assert Path(artifact.output_path).read_bytes() == b"GOOD"
    assert artifact.is_complete is False
    assert any("outside the partition" in warning for warning in result.warnings)


def test_detector_recognizes_all_supported_filesystem_families():
    ntfs = bytearray(4096)
    ntfs[3:11] = b"NTFS    "
    fat12 = bytearray(4096)
    fat12[54:62] = b"FAT12   "
    fat16 = bytearray(4096)
    fat16[54:62] = b"FAT16   "
    fat32 = bytearray(4096)
    fat32[82:90] = b"FAT32   "
    exfat = bytearray(4096)
    exfat[3:11] = b"EXFAT   "
    ext = bytearray(4096)
    ext[1080:1082] = b"\x53\xef"

    assert FileSystemAnalyzer._detect(ntfs)[0] == "ntfs"
    assert FileSystemAnalyzer._detect(fat12)[0] == "fat12"
    assert FileSystemAnalyzer._detect(fat16)[0] == "fat16"
    assert FileSystemAnalyzer._detect(fat32)[0] == "fat32"
    assert FileSystemAnalyzer._detect(exfat)[0] == "exfat"
    assert FileSystemAnalyzer._detect(ext)[0] == "ext"

    # The FAT type-label field is informational, so geometry must also work.
    unlabeled_fat12 = bytearray(4096)
    unlabeled_fat12[11:13] = (512).to_bytes(2, "little")
    unlabeled_fat12[13] = 1
    unlabeled_fat12[14:16] = (1).to_bytes(2, "little")
    unlabeled_fat12[16] = 2
    unlabeled_fat12[17:19] = (224).to_bytes(2, "little")
    unlabeled_fat12[19:21] = (2880).to_bytes(2, "little")
    unlabeled_fat12[22:24] = (9).to_bytes(2, "little")
    unlabeled_fat12[510:512] = b"\x55\xaa"
    assert FileSystemAnalyzer._detect(unlabeled_fat12)[0] == "fat12"


def test_partition_analyzer_keeps_superfloppy_volume(tmp_path):
    image = bytearray(4096)
    image[3:11] = b"NTFS    "
    image[510:512] = b"\x55\xaa"
    path = tmp_path / "superfloppy.img"
    path.write_bytes(image)

    with RawImageReader(path) as reader:
        table = PartitionAnalyzer().analyze(reader)

    assert table.scheme == "none"
    assert len(table.partitions) == 1
    assert table.partitions[0].start_offset == 0
