"""Filesystem identification interface; metadata parsers can be registered independently."""
from __future__ import annotations
from dataclasses import asdict, dataclass, field
from typing import Any, Callable
from core.image_reader.base import ImageReader
from core.partition import Partition


@dataclass
class FileSystemInfo:
    type: str
    partition_index: int
    start_offset: int
    label: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    files: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)


class FileSystemAnalyzer:
    """Detect common filesystems and dispatch optional metadata plugins."""
    _plugins: dict[str, Callable] = {}

    @classmethod
    def register(cls, fs_type: str, parser: Callable) -> None:
        cls._plugins[fs_type] = parser

    def analyze(self, reader: ImageReader, partition: Partition) -> FileSystemInfo:
        boot = reader.read_at(partition.start_offset, 4096)
        fs_type, label = self._detect(boot)
        info = FileSystemInfo(fs_type, partition.index, partition.start_offset, label)
        parser = self._plugins.get(fs_type)
        if parser:
            info.files = parser(reader, partition)
        return info

    @staticmethod
    def _detect(boot: bytes) -> tuple[str, str]:
        if len(boot) >= 11 and boot[3:11] == b"NTFS    ":
            return "ntfs", ""
        if len(boot) >= 90 and boot[82:90] == b"FAT32   ":
            return "fat32", boot[71:82].decode("ascii", "replace").strip()
        if len(boot) >= 11 and boot[3:11] == b"EXFAT   ":
            return "exfat", ""
        if len(boot) >= 1082 and boot[1080:1082] == b"\x53\xef":
            return "ext", ""
        return "unknown", ""
