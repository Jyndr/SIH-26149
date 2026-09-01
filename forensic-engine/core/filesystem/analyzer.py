"""Filesystem identification and metadata-parser dispatch."""
from __future__ import annotations
from dataclasses import asdict, dataclass, field
from typing import Any, Callable
from core.image_reader.base import ImageReader
from core.partition import Partition
from core.filesystem.recovery import public_filesystem_entry


@dataclass
class FileSystemInfo:
    type: str
    partition_index: int
    start_offset: int
    label: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    files: list[dict[str, Any]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    # Parser-private entries may contain resident bytes and are consumed by the
    # recovery stage.  They must never be serialized into report.json.
    entries: list[dict[str, Any]] = field(default_factory=list, repr=False)

    def to_dict(self):
        return {
            "type": self.type,
            "partition_index": self.partition_index,
            "start_offset": self.start_offset,
            "label": self.label,
            "metadata": self.metadata,
            "files": self.files,
            "warnings": self.warnings,
        }


class FileSystemAnalyzer:
    """Detect common filesystems and dispatch built-in or custom parsers."""
    _plugins: dict[str, Callable] = {}

    @classmethod
    def register(cls, fs_type: str, parser: Callable) -> None:
        cls._plugins[fs_type] = parser

    def analyze(self, reader: ImageReader, partition: Partition) -> FileSystemInfo:
        boot = reader.read_at(partition.start_offset, 4096)
        fs_type, label = self._detect(boot)
        info = FileSystemInfo(fs_type, partition.index, partition.start_offset, label)
        parser = self._plugins.get(fs_type) or self._builtin_parser(fs_type)
        if parser is None:
            if fs_type != "unknown":
                info.warnings.append(f"No metadata parser is available for {fs_type}")
            return info
        try:
            parsed = parser(reader, partition)
            if isinstance(parsed, dict):
                entries = parsed.get("files", [])
                metadata = parsed.get("metadata", {})
                if isinstance(metadata, dict):
                    info.metadata.update(metadata)
            else:
                entries = parsed
            if not isinstance(entries, list):
                raise TypeError("filesystem parser must return a list of entries")
            info.entries = [entry for entry in entries if isinstance(entry, dict)]
            info.files = [public_filesystem_entry(entry) for entry in info.entries]
            regular_files = [entry for entry in info.entries
                             if not entry.get("is_directory", False)]
            info.metadata.update({
                "entries_enumerated": len(info.entries),
                "files_enumerated": len(regular_files),
                "deleted_files_enumerated": sum(
                    bool(entry.get("is_deleted", entry.get("deleted", False)))
                    for entry in regular_files),
            })
            if not info.label:
                info.label = str(info.metadata.get("volume_name", ""))
                for system_entry in info.metadata.get("system_entries", []):
                    if (isinstance(system_entry, dict)
                            and system_entry.get("type") == "volume_label"
                            and system_entry.get("in_use", True)):
                        info.label = str(system_entry.get("label", info.label))
                        break
        except Exception as exc:
            # A corrupt filesystem must not prevent signature carving of the
            # same evidence.  Preserve the parser failure in the report.
            warning = f"{fs_type} metadata parser failed: {exc}"
            info.warnings.append(warning)
            info.metadata["parser_error"] = str(exc)
        return info

    @staticmethod
    def _builtin_parser(fs_type: str) -> Callable | None:
        # Lazy imports keep filesystem implementations independent and avoid
        # loading them for raw images that do not contain a recognized volume.
        if fs_type in {"fat12", "fat16", "fat32", "fat"}:
            from core.filesystem.fat import FATParser

            def parse_fat_with_metadata(reader, partition):
                parser = FATParser(reader, partition)
                return {"files": parser.enumerate_files(),
                        "metadata": {"volume": parser.volume.to_dict()}}
            return parse_fat_with_metadata
        if fs_type == "exfat":
            from core.filesystem.exfat import ExFATParser

            def parse_exfat_with_metadata(reader, partition):
                parser = ExFATParser(reader, partition)
                files = parser.enumerate_files()
                return {"files": files, "metadata": {
                    "volume": parser.volume.to_dict(),
                    "system_entries": parser.system_entries,
                }}
            return parse_exfat_with_metadata
        if fs_type == "ntfs":
            from core.filesystem.ntfs import NtfsParser

            def parse_ntfs_with_metadata(reader, partition):
                parser = NtfsParser(reader, partition)
                files = parser.parse()
                metadata = {"boot_sector": asdict(parser.boot)} if parser.boot else {}
                return {"files": files, "metadata": metadata}
            return parse_ntfs_with_metadata
        if fs_type == "ext":
            from core.filesystem.ext import ExtFileSystemParser

            def parse_ext_with_metadata(reader, partition):
                parser = ExtFileSystemParser(reader, partition)
                return {"files": parser.parse(), "metadata": parser.metadata}
            return parse_ext_with_metadata
        return None

    @staticmethod
    def _detect(boot: bytes) -> tuple[str, str]:
        if len(boot) >= 11 and boot[3:11] == b"NTFS    ":
            return "ntfs", ""
        if len(boot) >= 90 and boot[82:90] == b"FAT32   ":
            return "fat32", boot[71:82].decode("ascii", "replace").strip()
        if len(boot) >= 62 and boot[54:62] == b"FAT16   ":
            return "fat16", boot[43:54].decode("ascii", "replace").strip()
        if len(boot) >= 62 and boot[54:62] == b"FAT12   ":
            return "fat12", boot[43:54].decode("ascii", "replace").strip()
        if len(boot) >= 11 and boot[3:11] == b"EXFAT   ":
            return "exfat", ""
        if len(boot) >= 1082 and boot[1080:1082] == b"\x53\xef":
            return "ext", ""
        fat_variant = FileSystemAnalyzer._fat_bpb_variant(boot)
        if fat_variant:
            label_offset = 71 if fat_variant == "fat32" else 43
            label = boot[label_offset:label_offset + 11].decode(
                "ascii", "replace").strip()
            return fat_variant, label
        return "unknown", ""

    @staticmethod
    def _fat_bpb_variant(boot: bytes) -> str | None:
        """Identify FAT from validated BPB geometry when its type label is absent."""
        if len(boot) < 64 or boot[510:512] != b"\x55\xaa":
            return None
        bytes_per_sector = int.from_bytes(boot[11:13], "little")
        sectors_per_cluster = boot[13]
        reserved = int.from_bytes(boot[14:16], "little")
        fat_count = boot[16]
        root_entries = int.from_bytes(boot[17:19], "little")
        total_sectors = (int.from_bytes(boot[19:21], "little")
                         or int.from_bytes(boot[32:36], "little"))
        fat16_sectors = int.from_bytes(boot[22:24], "little")
        fat32_sectors = int.from_bytes(boot[36:40], "little")
        sectors_per_fat = fat16_sectors or fat32_sectors
        if (bytes_per_sector not in {512, 1024, 2048, 4096}
                or sectors_per_cluster == 0
                or sectors_per_cluster & (sectors_per_cluster - 1)
                or sectors_per_cluster > 128
                or reserved == 0 or not 1 <= fat_count <= 8
                or total_sectors == 0 or sectors_per_fat == 0):
            return None
        root_sectors = ((root_entries * 32 + bytes_per_sector - 1)
                        // bytes_per_sector)
        metadata_sectors = reserved + fat_count * sectors_per_fat + root_sectors
        if metadata_sectors >= total_sectors:
            return None
        clusters = (total_sectors - metadata_sectors) // sectors_per_cluster
        if clusters < 1:
            return None
        if root_entries == 0 and fat16_sectors == 0 and fat32_sectors:
            return "fat32"
        if clusters < 4085:
            return "fat12"
        if clusters < 65_525:
            return "fat16"
        return "fat32"
