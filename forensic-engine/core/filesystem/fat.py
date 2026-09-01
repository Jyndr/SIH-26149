"""Read-only FAT12/16/32 metadata enumeration.

The parser deliberately works against :class:`~core.image_reader.base.ImageReader`
instead of opening the evidence path itself.  All offsets reported in an entry are
absolute image offsets, so callers can recover a file without teaching the reader
about partitions or FAT.

``parse_fat`` is the small plugin-facing API.  ``FATParser`` is public as well for
callers that want the parsed volume geometry or custom corruption limits.
"""
from __future__ import annotations

import math
import struct
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterator

from core.image_reader.base import ImageReader
from core.partition import Partition


class FATError(ValueError):
    """Raised when a volume cannot safely be interpreted as FAT."""


@dataclass(frozen=True, slots=True)
class FATLimits:
    """Hard bounds used while following metadata from potentially corrupt media."""

    max_entries: int = 500_000
    max_directories: int = 100_000
    max_directory_depth: int = 128
    max_chain_clusters: int = 1_000_000
    max_lfn_entries: int = 20

    def __post_init__(self) -> None:
        for field_name in self.__dataclass_fields__:
            if getattr(self, field_name) <= 0:
                raise ValueError(f"{field_name} must be positive")


@dataclass(frozen=True, slots=True)
class FATVolume:
    variant: str
    start_offset: int
    end_offset: int
    bytes_per_sector: int
    sectors_per_cluster: int
    reserved_sectors: int
    fat_count: int
    active_fat: int
    sectors_per_fat: int
    total_sectors: int
    root_entry_count: int
    root_cluster: int
    cluster_count: int
    fat_offset: int
    root_directory_offset: int | None
    root_directory_size: int
    data_offset: int

    @property
    def cluster_size(self) -> int:
        return self.bytes_per_sector * self.sectors_per_cluster

    @property
    def max_cluster(self) -> int:
        # Data clusters are numbered 2 .. cluster_count + 1.
        return self.cluster_count + 1

    def to_dict(self) -> dict[str, Any]:
        return {
            "variant": self.variant,
            "start_offset": self.start_offset,
            "end_offset": self.end_offset,
            "bytes_per_sector": self.bytes_per_sector,
            "sectors_per_cluster": self.sectors_per_cluster,
            "cluster_size": self.cluster_size,
            "reserved_sectors": self.reserved_sectors,
            "fat_count": self.fat_count,
            "active_fat": self.active_fat,
            "sectors_per_fat": self.sectors_per_fat,
            "total_sectors": self.total_sectors,
            "root_entry_count": self.root_entry_count,
            "root_cluster": self.root_cluster,
            "cluster_count": self.cluster_count,
            "fat_offset": self.fat_offset,
            "root_directory_offset": self.root_directory_offset,
            "root_directory_size": self.root_directory_size,
            "data_offset": self.data_offset,
        }


_ATTRIBUTE_NAMES = (
    (0x01, "read_only"),
    (0x02, "hidden"),
    (0x04, "system"),
    (0x08, "volume_label"),
    (0x10, "directory"),
    (0x20, "archive"),
)


class FATParser:
    """Enumerate FAT directory metadata without modifying evidence."""

    def __init__(
        self,
        reader: ImageReader,
        partition: Partition,
        *,
        limits: FATLimits | None = None,
    ) -> None:
        self.reader = reader
        self.partition = partition
        self.limits = limits or FATLimits()
        self._media_start, self._media_end = self._partition_bounds()
        self.volume = self._parse_boot_sector()

    def _partition_bounds(self) -> tuple[int, int]:
        start = int(self.partition.start_offset)
        size = int(self.partition.size)
        media_size = int(self.reader.size)
        if start < 0 or size <= 0 or start >= media_size:
            raise FATError("partition is outside the image")
        end = min(media_size, start + size)
        if end - start < 512:
            raise FATError("partition is too small for a FAT boot sector")
        return start, end

    def _read_media(self, offset: int, size: int) -> bytes:
        """Read only inside the selected partition; never trust on-disk lengths."""

        if size < 0 or offset < self._media_start or offset > self._media_end:
            return b""
        allowed = min(size, self._media_end - offset)
        if allowed <= 0:
            return b""
        return self.reader.read_at(offset, allowed)[:allowed]

    def _read(self, offset: int, size: int) -> bytes:
        if size < 0 or offset < self.volume.start_offset or offset > self.volume.end_offset:
            return b""
        allowed = min(size, self.volume.end_offset - offset)
        if allowed <= 0:
            return b""
        return self.reader.read_at(offset, allowed)[:allowed]

    def _parse_boot_sector(self) -> FATVolume:
        boot = self._read_media(self._media_start, 512)
        if len(boot) < 64:
            raise FATError("truncated FAT boot sector")
        if len(boot) < 512 or boot[510:512] != b"\x55\xaa":
            raise FATError("FAT boot signature is missing")

        bytes_per_sector = struct.unpack_from("<H", boot, 11)[0]
        sectors_per_cluster = boot[13]
        reserved = struct.unpack_from("<H", boot, 14)[0]
        fat_count = boot[16]
        root_entries = struct.unpack_from("<H", boot, 17)[0]
        total16 = struct.unpack_from("<H", boot, 19)[0]
        fat16 = struct.unpack_from("<H", boot, 22)[0]
        total32 = struct.unpack_from("<I", boot, 32)[0]
        fat32 = struct.unpack_from("<I", boot, 36)[0]

        if bytes_per_sector not in (512, 1024, 2048, 4096):
            raise FATError("invalid FAT bytes-per-sector")
        if not _is_power_of_two(sectors_per_cluster) or sectors_per_cluster > 128:
            raise FATError("invalid FAT sectors-per-cluster")
        if reserved == 0 or not (1 <= fat_count <= 8):
            raise FATError("invalid FAT reserved-sector or FAT count")

        total_sectors = total16 or total32
        sectors_per_fat = fat16 or fat32
        if total_sectors == 0 or sectors_per_fat == 0:
            raise FATError("FAT volume has no declared size or allocation table")

        volume_bytes = total_sectors * bytes_per_sector
        if volume_bytes > self._media_end - self._media_start:
            raise FATError("FAT volume extends beyond the partition")
        volume_end = self._media_start + volume_bytes

        root_size = root_entries * 32
        root_sectors = (root_size + bytes_per_sector - 1) // bytes_per_sector
        first_data_sector = reserved + fat_count * sectors_per_fat + root_sectors
        if first_data_sector >= total_sectors:
            raise FATError("FAT data area is outside the volume")
        data_sectors = total_sectors - first_data_sector
        cluster_count = data_sectors // sectors_per_cluster
        if cluster_count < 1:
            raise FATError("FAT volume has no data clusters")

        # Cluster count is the standards-defined discriminator.  In practice,
        # formatters also create small FAT32 volumes below the recommended
        # 65,525-cluster threshold.  Its mutually exclusive BPB layout remains
        # unambiguous and is safe to honor for recovery.
        explicit_fat32_layout = root_entries == 0 and fat16 == 0 and fat32 != 0
        if explicit_fat32_layout:
            variant = "fat32"
            entry_bits = 32
        elif cluster_count < 4085:
            variant = "fat12"
            entry_bits = 12
        elif cluster_count < 65_525:
            variant = "fat16"
            entry_bits = 16
        else:
            variant = "fat32"
            entry_bits = 32

        # The FAT must at least be capable of addressing every declared cluster.
        required_fat_bytes = math.ceil((cluster_count + 2) * entry_bits / 8)
        if required_fat_bytes > sectors_per_fat * bytes_per_sector:
            raise FATError("FAT is too small for the declared cluster count")

        active_fat = 0
        if variant == "fat32":
            extended_flags = struct.unpack_from("<H", boot, 40)[0]
            if extended_flags & 0x0080:
                active_fat = extended_flags & 0x000F
                if active_fat >= fat_count:
                    raise FATError("invalid active FAT32 allocation table")
        fat_offset = self._media_start + (
            reserved + active_fat * sectors_per_fat
        ) * bytes_per_sector
        root_offset = self._media_start + (
            reserved + fat_count * sectors_per_fat
        ) * bytes_per_sector
        data_offset = self._media_start + first_data_sector * bytes_per_sector
        root_cluster = struct.unpack_from("<I", boot, 44)[0] & 0x0FFFFFFF
        if variant == "fat32":
            if root_entries != 0:
                raise FATError("FAT32 fixed root-entry count must be zero")
            if fat16 != 0 or fat32 == 0:
                raise FATError("invalid FAT32 allocation-table geometry")
            if not (2 <= root_cluster <= cluster_count + 1):
                raise FATError("invalid FAT32 root directory cluster")
            fixed_root_offset: int | None = None
            fixed_root_size = 0
        else:
            if root_entries == 0 or fat16 == 0:
                raise FATError("invalid FAT12/16 root or allocation-table geometry")
            fixed_root_offset = root_offset
            fixed_root_size = root_size
            root_cluster = 0

        return FATVolume(
            variant=variant,
            start_offset=self._media_start,
            end_offset=volume_end,
            bytes_per_sector=bytes_per_sector,
            sectors_per_cluster=sectors_per_cluster,
            reserved_sectors=reserved,
            fat_count=fat_count,
            active_fat=active_fat,
            sectors_per_fat=sectors_per_fat,
            total_sectors=total_sectors,
            root_entry_count=root_entries,
            root_cluster=root_cluster,
            cluster_count=cluster_count,
            fat_offset=fat_offset,
            root_directory_offset=fixed_root_offset,
            root_directory_size=fixed_root_size,
            data_offset=data_offset,
        )

    def enumerate_files(self) -> list[dict[str, Any]]:
        """Return file and directory entries, including recoverable deletions."""

        results: list[dict[str, Any]] = []
        # parent path, first cluster, fixed-root flag, depth, ancestor deleted
        directories: list[tuple[str, int, bool, int, bool]] = [
            ("/", self.volume.root_cluster, self.volume.variant != "fat32", 0, False)
        ]
        visited_clusters: set[int] = set()
        directories_seen = 0

        while directories and len(results) < self.limits.max_entries:
            parent_path, first_cluster, fixed_root, depth, ancestor_deleted = directories.pop()
            if depth > self.limits.max_directory_depth:
                continue
            if not fixed_root:
                if not self._valid_cluster(first_cluster) or first_cluster in visited_clusters:
                    continue
                visited_clusters.add(first_cluster)
            directories_seen += 1
            if directories_seen > self.limits.max_directories:
                break

            pending_lfn: list[bytes] = []
            for entry_offset, raw in self._directory_slots(first_cluster, fixed_root):
                first_byte = raw[0]
                if first_byte == 0x00:
                    break
                attributes = raw[11]
                if attributes == 0x0F:
                    pending_lfn.append(raw)
                    if len(pending_lfn) > self.limits.max_lfn_entries:
                        pending_lfn.pop(0)
                    continue

                lfn_name, lfn_valid = self._long_name(pending_lfn, raw[:11])
                pending_lfn.clear()
                # Volume-label records do not represent extractable filesystem nodes.
                if attributes & 0x08:
                    continue

                entry_deleted = first_byte == 0xE5
                short_name = self._short_name(raw)
                name = _clean_name(lfn_name if lfn_valid else short_name)
                if not name:
                    name = f"unnamed-{entry_offset:x}"
                if name in (".", ".."):
                    continue

                is_directory = bool(attributes & 0x10)
                is_deleted = entry_deleted or ancestor_deleted
                first_cluster_low = struct.unpack_from("<H", raw, 26)[0]
                first_cluster_high = (
                    struct.unpack_from("<H", raw, 20)[0]
                    if self.volume.variant == "fat32"
                    else 0
                )
                data_cluster = ((first_cluster_high << 16) | first_cluster_low) & 0x0FFFFFFF
                size = struct.unpack_from("<I", raw, 28)[0]
                path = _join_path(parent_path, name)

                if is_directory:
                    chain, chain_status = self._walk_chain(data_cluster)
                    chain_source = "fat"
                    directory_bytes = len(chain) * self.volume.cluster_size
                    extents = self._extents(chain, directory_bytes)
                    complete = bool(chain) and chain_status == "eoc"
                else:
                    chain, chain_status, chain_source, complete = self._file_chain(
                        data_cluster, size, is_deleted
                    )
                    extents = self._extents(chain, size)

                physical_extents = [extent for extent in extents if not extent["sparse"]]
                result: dict[str, Any] = {
                    "filesystem": self.volume.variant,
                    "path": path,
                    "name": name,
                    "parent_path": parent_path,
                    "type": "directory" if is_directory else "file",
                    "is_directory": is_directory,
                    "is_deleted": is_deleted,
                    "allocated": not is_deleted,
                    "size": size,
                    "logical_size": size,
                    "attributes": [
                        label for bit, label in _ATTRIBUTE_NAMES if attributes & bit
                    ],
                    "attribute_flags": attributes,
                    "timestamps": self._timestamps(raw),
                    "first_cluster": data_cluster,
                    "cluster_chain": chain,
                    "extents": extents,
                    "offset": physical_extents[0]["image_offset"] if physical_extents else None,
                    "is_complete": complete,
                    "is_fragmented": len(physical_extents) > 1,
                    "metadata": {
                        "directory_entry_offset": entry_offset,
                        "short_name": short_name,
                        "long_name": lfn_name if lfn_valid else None,
                        "long_name_valid": lfn_valid,
                        "name_status": (
                            "long_name"
                            if lfn_valid
                            else "partial_short_name"
                            if entry_deleted
                            else "short_name"
                        ),
                        "entry_deleted": entry_deleted,
                        "ancestor_deleted": ancestor_deleted,
                        "chain_source": chain_source,
                        "chain_status": chain_status,
                        "cluster_size": self.volume.cluster_size,
                    },
                }
                results.append(result)
                if len(results) >= self.limits.max_entries:
                    break

                if (
                    is_directory
                    and data_cluster not in (0, 1)
                    and depth < self.limits.max_directory_depth
                ):
                    directories.append(
                        (path, data_cluster, False, depth + 1, is_deleted)
                    )

        return results

    def _directory_slots(
        self, first_cluster: int, fixed_root: bool
    ) -> Iterator[tuple[int, bytes]]:
        if fixed_root:
            assert self.volume.root_directory_offset is not None
            remaining = self.volume.root_directory_size
            offset = self.volume.root_directory_offset
            while remaining >= 32:
                block_size = min(remaining, self.volume.bytes_per_sector)
                block = self._read(offset, block_size)
                for inner in range(0, len(block) - 31, 32):
                    yield offset + inner, block[inner:inner + 32]
                if len(block) < block_size:
                    return
                offset += block_size
                remaining -= block_size
            return

        chain, _ = self._walk_chain(first_cluster)
        for cluster in chain:
            offset = self._cluster_offset(cluster)
            block = self._read(offset, self.volume.cluster_size)
            for inner in range(0, len(block) - 31, 32):
                yield offset + inner, block[inner:inner + 32]
            if len(block) < self.volume.cluster_size:
                return

    def _file_chain(
        self, first_cluster: int, size: int, deleted: bool
    ) -> tuple[list[int], str, str, bool]:
        if size == 0:
            return [], "empty", "none", True
        required = (size + self.volume.cluster_size - 1) // self.volume.cluster_size
        if not self._valid_cluster(first_cluster):
            return [], "invalid_first_cluster", "fat", False

        chain, status = self._walk_chain(first_cluster, expected=required)
        source = "fat"
        complete = len(chain) >= required

        # FAT deletion normally clears the allocation-table chain while leaving
        # the starting cluster and size in the directory record.  A contiguous
        # free run is useful recovery metadata, but is explicitly marked as an
        # inference and never claimed to be a complete verified chain.
        first_is_free = self._fat_value(first_cluster) == 0
        if deleted and first_is_free and status in ("free", "sufficient"):
            inferred = self._infer_contiguous_free_chain(first_cluster, required)
            if len(inferred) >= len(chain):
                chain = inferred
                status = "inferred_contiguous_free"
                source = "contiguous_inference"
                complete = False
        return chain, status, source, complete

    def _infer_contiguous_free_chain(self, first: int, count: int) -> list[int]:
        count = min(count, self.limits.max_chain_clusters)
        if count <= 0 or first + count - 1 > self.volume.max_cluster:
            return []
        inferred: list[int] = []
        for cluster in range(first, first + count):
            if self._fat_value(cluster) != 0:
                break
            inferred.append(cluster)
        return inferred

    def _walk_chain(
        self, first: int, *, expected: int | None = None
    ) -> tuple[list[int], str]:
        if not self._valid_cluster(first):
            return [], "invalid_first_cluster"
        wanted = None if expected is None else max(0, expected)
        if wanted == 0:
            return [], "empty"

        chain: list[int] = []
        visited: set[int] = set()
        current = first
        for _ in range(self.limits.max_chain_clusters):
            if not self._valid_cluster(current):
                return chain, "out_of_range"
            if current in visited:
                return chain, "cycle"
            visited.add(current)
            chain.append(current)
            if wanted is not None and len(chain) >= wanted:
                return chain, "sufficient"

            value = self._fat_value(current)
            if value is None:
                return chain, "truncated_fat"
            if value == 0:
                return chain, "free"
            if self._is_bad(value):
                return chain, "bad_cluster"
            if self._is_eoc(value):
                return chain, "eoc"
            if self._is_reserved(value):
                return chain, "reserved"
            current = value
        return chain, "limit"

    def _fat_value(self, cluster: int) -> int | None:
        if self.volume.variant == "fat12":
            relative = cluster + cluster // 2
            raw = self._read(self.volume.fat_offset + relative, 2)
            if len(raw) != 2:
                return None
            value = int.from_bytes(raw, "little")
            return (value >> 4) & 0xFFF if cluster & 1 else value & 0xFFF
        if self.volume.variant == "fat16":
            raw = self._read(self.volume.fat_offset + cluster * 2, 2)
            return int.from_bytes(raw, "little") if len(raw) == 2 else None
        raw = self._read(self.volume.fat_offset + cluster * 4, 4)
        return (int.from_bytes(raw, "little") & 0x0FFFFFFF) if len(raw) == 4 else None

    def _is_eoc(self, value: int) -> bool:
        if self.volume.variant == "fat12":
            return value >= 0xFF8
        if self.volume.variant == "fat16":
            return value >= 0xFFF8
        return value >= 0x0FFFFFF8

    def _is_bad(self, value: int) -> bool:
        return value == {
            "fat12": 0xFF7,
            "fat16": 0xFFF7,
            "fat32": 0x0FFFFFF7,
        }[self.volume.variant]

    def _is_reserved(self, value: int) -> bool:
        low, high = {
            "fat12": (0xFF0, 0xFF6),
            "fat16": (0xFFF0, 0xFFF6),
            "fat32": (0x0FFFFFF0, 0x0FFFFFF6),
        }[self.volume.variant]
        return value in (1,) or low <= value <= high

    def _valid_cluster(self, cluster: int) -> bool:
        return 2 <= cluster <= self.volume.max_cluster

    def _cluster_offset(self, cluster: int) -> int:
        return self.volume.data_offset + (cluster - 2) * self.volume.cluster_size

    def _extents(self, chain: list[int], logical_size: int) -> list[dict[str, Any]]:
        extents: list[dict[str, Any]] = []
        remaining = logical_size
        logical_offset = 0
        for cluster in chain:
            if remaining <= 0:
                break
            length = min(self.volume.cluster_size, remaining)
            image_offset = self._cluster_offset(cluster)
            if image_offset < self.volume.data_offset or image_offset + length > self.volume.end_offset:
                break
            if (
                extents
                and not extents[-1]["sparse"]
                and extents[-1]["image_offset"] + extents[-1]["length"] == image_offset
                and extents[-1]["logical_offset"] + extents[-1]["length"] == logical_offset
            ):
                extents[-1]["length"] += length
            else:
                extents.append(
                    {
                        "image_offset": image_offset,
                        "logical_offset": logical_offset,
                        "length": length,
                        "sparse": False,
                    }
                )
            remaining -= length
            logical_offset += length
        return extents

    def _short_name(self, raw: bytes) -> str:
        name_bytes = bytearray(raw[:8])
        extension_bytes = bytearray(raw[8:11])
        deleted = name_bytes[0] == 0xE5
        if name_bytes[0] == 0x05:
            name_bytes[0] = 0xE5
        elif deleted:
            # Deletion destroys the original first byte.  Keep that uncertainty
            # visible instead of inventing a character.
            name_bytes[0] = ord("?")
        name = bytes(name_bytes).decode("cp437", "replace").rstrip(" ")
        extension = bytes(extension_bytes).decode("cp437", "replace").rstrip(" ")
        nt_case = raw[12]
        if nt_case & 0x08:
            name = name.lower()
        if nt_case & 0x10:
            extension = extension.lower()
        return f"{name}.{extension}" if extension else name

    def _long_name(self, entries: list[bytes], short_raw: bytes) -> tuple[str, bool]:
        if not entries:
            return "", False

        deleted_lfn = all(entry[0] == 0xE5 for entry in entries)
        checksum_values = {entry[13] for entry in entries}
        if len(checksum_values) != 1:
            return "", False

        if deleted_lfn and short_raw[0] == 0xE5:
            ordered = list(reversed(entries))
        else:
            expected_checksum = _short_name_checksum(short_raw)
            if checksum_values != {expected_checksum}:
                return "", False
            by_ordinal: dict[int, bytes] = {}
            maximum = 0
            saw_last = False
            for entry in entries:
                ordinal_raw = entry[0]
                ordinal = ordinal_raw & 0x1F
                if ordinal == 0 or ordinal > self.limits.max_lfn_entries:
                    return "", False
                by_ordinal[ordinal] = entry
                maximum = max(maximum, ordinal)
                saw_last |= bool(ordinal_raw & 0x40)
            if not saw_last or set(by_ordinal) != set(range(1, maximum + 1)):
                return "", False
            ordered = [by_ordinal[index] for index in range(1, maximum + 1)]

        encoded = b"".join(_lfn_fragment(entry) for entry in ordered)
        units: list[bytes] = []
        for index in range(0, len(encoded), 2):
            unit = encoded[index:index + 2]
            if unit == b"\x00\x00":
                break
            if unit == b"\xff\xff":
                continue
            units.append(unit)
        if not units:
            return "", False
        name = b"".join(units).decode("utf-16-le", "replace")
        return name, bool(name)

    @staticmethod
    def _timestamps(raw: bytes) -> dict[str, str | None]:
        return {
            "created": _fat_datetime(
                struct.unpack_from("<H", raw, 16)[0],
                struct.unpack_from("<H", raw, 14)[0],
                raw[13],
            ),
            "modified": _fat_datetime(
                struct.unpack_from("<H", raw, 24)[0],
                struct.unpack_from("<H", raw, 22)[0],
                None,
            ),
            "accessed": _fat_datetime(
                struct.unpack_from("<H", raw, 18)[0], 0, None
            ),
        }


def parse_fat(
    reader: ImageReader,
    partition: Partition,
    *,
    limits: FATLimits | None = None,
) -> list[dict[str, Any]]:
    """Plugin-compatible FAT parser.

    Invalid or truncated metadata produces no entries rather than terminating the
    wider forensic pipeline.  Use ``FATParser`` directly when the caller needs a
    diagnostic ``FATError``.
    """

    try:
        return FATParser(reader, partition, limits=limits).enumerate_files()
    except (FATError, OSError, OverflowError, struct.error):
        return []


def _is_power_of_two(value: int) -> bool:
    return value > 0 and value & (value - 1) == 0


def _short_name_checksum(short_name: bytes) -> int:
    checksum = 0
    for value in short_name[:11]:
        checksum = (((checksum & 1) << 7) | (checksum >> 1)) + value
        checksum &= 0xFF
    return checksum


def _lfn_fragment(entry: bytes) -> bytes:
    return entry[1:11] + entry[14:26] + entry[28:32]


def _clean_name(name: str) -> str:
    # A corrupt directory name must not be able to escape a recovery directory.
    cleaned = "".join(
        "_" if character in ("/", "\\", "\x00") or ord(character) < 32 else character
        for character in name
    )
    return cleaned.strip()


def _join_path(parent: str, name: str) -> str:
    return f"/{name}" if parent == "/" else f"{parent.rstrip('/')}/{name}"


def _fat_datetime(date_value: int, time_value: int, tenths: int | None) -> str | None:
    if date_value == 0:
        return None
    year = 1980 + ((date_value >> 9) & 0x7F)
    month = (date_value >> 5) & 0x0F
    day = date_value & 0x1F
    hour = (time_value >> 11) & 0x1F
    minute = (time_value >> 5) & 0x3F
    second = (time_value & 0x1F) * 2
    microsecond = 0
    if tenths is not None and tenths <= 199:
        second += tenths // 100
        microsecond = (tenths % 100) * 10_000
    try:
        return datetime(year, month, day, hour, minute, second, microsecond).isoformat()
    except ValueError:
        return None


__all__ = ["FATError", "FATLimits", "FATParser", "FATVolume", "parse_fat"]
