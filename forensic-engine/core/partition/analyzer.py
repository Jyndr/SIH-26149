"""Read-only MBR/GPT partition discovery."""
from __future__ import annotations
import struct
from dataclasses import asdict, dataclass
from core.image_reader.base import ImageReader

SECTOR_SIZE = 512


@dataclass(frozen=True)
class Partition:
    index: int
    start_offset: int
    size: int
    type_id: str
    name: str = ""
    allocated: bool = True

    def to_dict(self):
        return asdict(self)


@dataclass
class PartitionTable:
    scheme: str
    partitions: list[Partition]

    def to_dict(self):
        return {"scheme": self.scheme, "partitions": [p.to_dict() for p in self.partitions]}


class PartitionAnalyzer:
    def analyze(self, reader: ImageReader) -> PartitionTable:
        sector = reader.read_at(0, SECTOR_SIZE)
        if len(sector) < SECTOR_SIZE or sector[510:512] != b"\x55\xaa":
            return PartitionTable("none", [Partition(1, 0, reader.size, "raw", "Whole image")])
        entries = []
        protective = False
        for index in range(4):
            entry = sector[446 + index * 16:462 + index * 16]
            type_id = entry[4]
            start_lba, sectors = struct.unpack("<II", entry[8:16])
            if type_id == 0 or sectors == 0:
                continue
            protective |= type_id == 0xEE
            entries.append(Partition(index + 1, start_lba * SECTOR_SIZE,
                                     sectors * SECTOR_SIZE, f"0x{type_id:02x}"))
        if protective and reader.read_at(SECTOR_SIZE, 8) == b"EFI PART":
            return self._gpt(reader)
        return PartitionTable("mbr", entries)

    def _gpt(self, reader: ImageReader) -> PartitionTable:
        header = reader.read_at(SECTOR_SIZE, 92)
        entries_lba = struct.unpack("<Q", header[72:80])[0]
        count, entry_size = struct.unpack("<II", header[80:88])
        partitions = []
        # Bound corrupt headers: GPT normally has 128 entries.
        for index in range(min(count, 4096)):
            raw = reader.read_at(entries_lba * SECTOR_SIZE + index * entry_size, entry_size)
            if len(raw) < 56 or raw[:16] == b"\0" * 16:
                continue
            first, last = struct.unpack("<QQ", raw[32:48])
            if last < first:
                continue
            name = raw[56:min(len(raw), 128)].decode("utf-16-le", "replace").rstrip("\0")
            partitions.append(Partition(index + 1, first * SECTOR_SIZE,
                                        (last - first + 1) * SECTOR_SIZE,
                                        raw[:16].hex(), name))
        return PartitionTable("gpt", partitions)
