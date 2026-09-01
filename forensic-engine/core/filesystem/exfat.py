"""Read-only exFAT metadata enumeration.

This module parses the exFAT boot geometry and directory entry sets directly from
an ``ImageReader``.  It performs no repair and never writes to evidence.  File
extents use absolute image offsets and can therefore be handed directly to a
generic recovery/extraction layer.
"""
from __future__ import annotations

import struct
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

from core.image_reader.base import ImageReader
from core.partition import Partition


class ExFATError(ValueError):
    """Raised when a volume cannot safely be interpreted as exFAT."""


@dataclass(frozen=True, slots=True)
class ExFATLimits:
    """Bounds for metadata controlled loops and allocations."""

    max_entries: int = 500_000
    max_directories: int = 100_000
    max_directory_depth: int = 128
    max_chain_clusters: int = 1_000_000
    max_secondary_entries: int = 64
    directory_read_chunk: int = 1024 * 1024

    def __post_init__(self) -> None:
        for field_name in self.__dataclass_fields__:
            if getattr(self, field_name) <= 0:
                raise ValueError(f"{field_name} must be positive")
        if self.directory_read_chunk < 32:
            raise ValueError("directory_read_chunk must hold at least one entry")


@dataclass(frozen=True, slots=True)
class ExFATVolume:
    start_offset: int
    end_offset: int
    bytes_per_sector: int
    sectors_per_cluster: int
    volume_sectors: int
    fat_offset: int
    fat_length: int
    fat_count: int
    active_fat: int
    cluster_heap_offset: int
    cluster_count: int
    root_cluster: int
    serial_number: int
    revision: int
    volume_flags: int
    percent_in_use: int | None

    @property
    def cluster_size(self) -> int:
        return self.bytes_per_sector * self.sectors_per_cluster

    @property
    def max_cluster(self) -> int:
        return self.cluster_count + 1

    def to_dict(self) -> dict[str, Any]:
        return {
            "variant": "exfat",
            "start_offset": self.start_offset,
            "end_offset": self.end_offset,
            "bytes_per_sector": self.bytes_per_sector,
            "sectors_per_cluster": self.sectors_per_cluster,
            "cluster_size": self.cluster_size,
            "volume_sectors": self.volume_sectors,
            "fat_offset": self.fat_offset,
            "fat_length": self.fat_length,
            "fat_count": self.fat_count,
            "active_fat": self.active_fat,
            "cluster_heap_offset": self.cluster_heap_offset,
            "cluster_count": self.cluster_count,
            "root_cluster": self.root_cluster,
            "serial_number": self.serial_number,
            "revision": self.revision,
            "volume_flags": self.volume_flags,
            "percent_in_use": self.percent_in_use,
        }


_ATTRIBUTE_NAMES = (
    (0x01, "read_only"),
    (0x02, "hidden"),
    (0x04, "system"),
    (0x10, "directory"),
    (0x20, "archive"),
)


class ExFATParser:
    """Enumerate exFAT file entry sets, including deleted entry sets."""

    def __init__(
        self,
        reader: ImageReader,
        partition: Partition,
        *,
        limits: ExFATLimits | None = None,
    ) -> None:
        self.reader = reader
        self.partition = partition
        self.limits = limits or ExFATLimits()
        self._media_start, self._media_end = self._partition_bounds()
        self.volume = self._parse_boot_sector()
        self.system_entries: list[dict[str, Any]] = []

    def _partition_bounds(self) -> tuple[int, int]:
        start = int(self.partition.start_offset)
        size = int(self.partition.size)
        media_size = int(self.reader.size)
        if start < 0 or size <= 0 or start >= media_size:
            raise ExFATError("partition is outside the image")
        end = min(media_size, start + size)
        if end - start < 512:
            raise ExFATError("partition is too small for an exFAT boot sector")
        return start, end

    def _read_media(self, offset: int, size: int) -> bytes:
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

    def _parse_boot_sector(self) -> ExFATVolume:
        boot = self._read_media(self._media_start, 512)
        if len(boot) != 512 or boot[3:11] != b"EXFAT   ":
            raise ExFATError("exFAT signature is missing")
        if boot[510:512] != b"\x55\xaa":
            raise ExFATError("exFAT boot signature is missing")

        volume_sectors = struct.unpack_from("<Q", boot, 72)[0]
        fat_sector = struct.unpack_from("<I", boot, 80)[0]
        fat_length_sectors = struct.unpack_from("<I", boot, 84)[0]
        heap_sector = struct.unpack_from("<I", boot, 88)[0]
        cluster_count = struct.unpack_from("<I", boot, 92)[0]
        root_cluster = struct.unpack_from("<I", boot, 96)[0]
        serial = struct.unpack_from("<I", boot, 100)[0]
        revision = struct.unpack_from("<H", boot, 104)[0]
        flags = struct.unpack_from("<H", boot, 106)[0]
        bytes_shift = boot[108]
        sectors_shift = boot[109]
        fat_count = boot[110]
        percent_raw = boot[112]

        if not 9 <= bytes_shift <= 12:
            raise ExFATError("invalid exFAT bytes-per-sector shift")
        if sectors_shift > 25 - bytes_shift:
            raise ExFATError("invalid exFAT sectors-per-cluster shift")
        bytes_per_sector = 1 << bytes_shift
        sectors_per_cluster = 1 << sectors_shift
        if fat_count not in (1, 2):
            raise ExFATError("invalid exFAT FAT count")
        if volume_sectors == 0 or fat_sector == 0 or fat_length_sectors == 0:
            raise ExFATError("invalid exFAT volume or FAT geometry")
        if cluster_count == 0:
            raise ExFATError("exFAT volume has no clusters")

        volume_bytes = volume_sectors * bytes_per_sector
        if volume_bytes > self._media_end - self._media_start:
            raise ExFATError("exFAT volume extends beyond the partition")
        volume_end = self._media_start + volume_bytes
        if heap_sector >= volume_sectors:
            raise ExFATError("exFAT cluster heap is outside the volume")
        heap_end_sector = heap_sector + cluster_count * sectors_per_cluster
        if heap_end_sector > volume_sectors:
            raise ExFATError("exFAT cluster heap exceeds the volume")
        if fat_sector + fat_count * fat_length_sectors > heap_sector:
            raise ExFATError("exFAT FAT overlaps the cluster heap")
        if (cluster_count + 2) * 4 > fat_length_sectors * bytes_per_sector:
            raise ExFATError("exFAT allocation table is too small")
        if not (2 <= root_cluster <= cluster_count + 1):
            raise ExFATError("invalid exFAT root directory cluster")

        active_fat = (flags & 1) if fat_count == 2 else 0
        fat_offset = self._media_start + (
            fat_sector + active_fat * fat_length_sectors
        ) * bytes_per_sector
        return ExFATVolume(
            start_offset=self._media_start,
            end_offset=volume_end,
            bytes_per_sector=bytes_per_sector,
            sectors_per_cluster=sectors_per_cluster,
            volume_sectors=volume_sectors,
            fat_offset=fat_offset,
            fat_length=fat_length_sectors * bytes_per_sector,
            fat_count=fat_count,
            active_fat=active_fat,
            cluster_heap_offset=self._media_start + heap_sector * bytes_per_sector,
            cluster_count=cluster_count,
            root_cluster=root_cluster,
            serial_number=serial,
            revision=revision,
            volume_flags=flags,
            percent_in_use=percent_raw if percent_raw <= 100 else None,
        )

    def enumerate_files(self) -> list[dict[str, Any]]:
        """Return file and directory metadata in stable, extraction-ready dicts."""

        results: list[dict[str, Any]] = []
        # path, first cluster, data length, no-FAT-chain, root, depth, ancestor deleted
        directories: list[tuple[str, int, int, bool, bool, int, bool]] = [
            ("/", self.volume.root_cluster, 0, False, True, 0, False)
        ]
        visited_clusters: set[int] = set()
        directory_count = 0

        while directories and len(results) < self.limits.max_entries:
            (
                parent_path,
                first_cluster,
                directory_length,
                no_fat_chain,
                is_root,
                depth,
                ancestor_deleted,
            ) = directories.pop()
            if depth > self.limits.max_directory_depth:
                continue
            if not self._valid_cluster(first_cluster) or first_cluster in visited_clusters:
                continue
            visited_clusters.add(first_cluster)
            directory_count += 1
            if directory_count > self.limits.max_directories:
                break

            slots = iter(
                self._directory_slots(
                    first_cluster, directory_length, no_fat_chain, is_root=is_root
                )
            )
            for primary_offset, primary in slots:
                entry_type = primary[0]
                if entry_type == 0x00:
                    break
                base_type = entry_type & 0x7F
                if is_root and base_type in (0x01, 0x02, 0x03):
                    self._record_system_entry(primary_offset, primary)
                    continue
                if base_type != 0x05:
                    continue

                secondary_count = primary[1]
                if secondary_count < 2 or secondary_count > self.limits.max_secondary_entries:
                    # Do not follow a corrupt count into unrelated clusters.
                    continue
                secondaries: list[tuple[int, bytes]] = []
                truncated = False
                for _ in range(secondary_count):
                    try:
                        secondary_offset, secondary = next(slots)
                    except StopIteration:
                        truncated = True
                        break
                    if secondary[0] == 0x00:
                        truncated = True
                        break
                    secondaries.append((secondary_offset, secondary))
                if truncated or len(secondaries) != secondary_count:
                    break

                stream_pair = next(
                    (
                        item
                        for item in secondaries
                        if (item[1][0] & 0x7F) == 0x40
                    ),
                    None,
                )
                if stream_pair is None:
                    continue
                stream_offset, stream = stream_pair
                name_records = [
                    raw for _, raw in secondaries if (raw[0] & 0x7F) == 0x41
                ]
                name_length = stream[3]
                name, name_complete = _decode_filename(name_records, name_length)
                name = _clean_name(name)
                if not name:
                    name = f"unnamed-{primary_offset:x}"

                entry_deleted = not bool(entry_type & 0x80)
                is_deleted = entry_deleted or ancestor_deleted
                attributes = struct.unpack_from("<H", primary, 4)[0]
                is_directory = bool(attributes & 0x10)
                stream_flags = stream[1]
                no_fat = bool(stream_flags & 0x02)
                valid_data_length = struct.unpack_from("<Q", stream, 8)[0]
                data_cluster = struct.unpack_from("<I", stream, 20)[0]
                data_length = struct.unpack_from("<Q", stream, 24)[0]
                path = _join_path(parent_path, name)

                (
                    chain,
                    extents,
                    chain_status,
                    chain_complete,
                    chain_truncated,
                ) = self._stream_allocation(
                    data_cluster,
                    data_length,
                    valid_data_length,
                    no_fat,
                    directory=is_directory,
                )
                physical_extents = [extent for extent in extents if not extent["sparse"]]
                set_records = [primary] + [raw for _, raw in secondaries]
                checksum_stored = struct.unpack_from("<H", primary, 2)[0]
                checksum_calculated = _entry_set_checksum(
                    set_records, restore_in_use=entry_deleted
                )
                checksum_valid = checksum_stored == checksum_calculated

                result: dict[str, Any] = {
                    "filesystem": "exfat",
                    "path": path,
                    "name": name,
                    "parent_path": parent_path,
                    "type": "directory" if is_directory else "file",
                    "is_directory": is_directory,
                    "is_deleted": is_deleted,
                    "allocated": not is_deleted,
                    "size": data_length,
                    "logical_size": data_length,
                    "valid_data_length": min(valid_data_length, data_length),
                    "attributes": [
                        label for bit, label in _ATTRIBUTE_NAMES if attributes & bit
                    ],
                    "attribute_flags": attributes,
                    "timestamps": _timestamps(primary),
                    "first_cluster": data_cluster,
                    "cluster_chain": chain,
                    "extents": extents,
                    "offset": physical_extents[0]["image_offset"] if physical_extents else None,
                    "is_complete": chain_complete and name_complete and checksum_valid,
                    "is_fragmented": len(physical_extents) > 1,
                    "metadata": {
                        "directory_entry_offset": primary_offset,
                        "stream_entry_offset": stream_offset,
                        "entry_set_checksum": checksum_stored,
                        "calculated_entry_set_checksum": checksum_calculated,
                        "entry_set_checksum_valid": checksum_valid,
                        "secondary_count": secondary_count,
                        "stream_flags": stream_flags,
                        "no_fat_chain": no_fat,
                        "name_length": name_length,
                        "name_complete": name_complete,
                        "name_hash": struct.unpack_from("<H", stream, 4)[0],
                        "entry_deleted": entry_deleted,
                        "ancestor_deleted": ancestor_deleted,
                        "chain_source": "contiguous" if no_fat else "fat",
                        "chain_status": chain_status,
                        "cluster_chain_truncated": chain_truncated,
                        "cluster_size": self.volume.cluster_size,
                        "valid_data_length_raw": valid_data_length,
                    },
                }
                results.append(result)
                if len(results) >= self.limits.max_entries:
                    break

                if (
                    is_directory
                    and self._valid_cluster(data_cluster)
                    and depth < self.limits.max_directory_depth
                ):
                    directories.append(
                        (
                            path,
                            data_cluster,
                            data_length,
                            no_fat,
                            False,
                            depth + 1,
                            is_deleted,
                        )
                    )

        return results

    def _record_system_entry(self, offset: int, raw: bytes) -> None:
        base_type = raw[0] & 0x7F
        if base_type == 0x01:
            kind = "allocation_bitmap"
            details: dict[str, Any] = {
                "bitmap_id": raw[1] & 1,
                "first_cluster": struct.unpack_from("<I", raw, 20)[0],
                "data_length": struct.unpack_from("<Q", raw, 24)[0],
            }
        elif base_type == 0x02:
            kind = "upcase_table"
            details = {
                "checksum": struct.unpack_from("<I", raw, 4)[0],
                "first_cluster": struct.unpack_from("<I", raw, 20)[0],
                "data_length": struct.unpack_from("<Q", raw, 24)[0],
            }
        else:
            kind = "volume_label"
            character_count = min(raw[1], 11)
            details = {
                "label": raw[2:2 + character_count * 2].decode(
                    "utf-16-le", "replace"
                )
            }
        self.system_entries.append(
            {
                "type": kind,
                "offset": offset,
                "in_use": bool(raw[0] & 0x80),
                **details,
            }
        )

    def _directory_slots(
        self,
        first_cluster: int,
        data_length: int,
        no_fat_chain: bool,
        *,
        is_root: bool,
    ) -> Iterator[tuple[int, bytes]]:
        if is_root:
            chain, _ = self._walk_chain(first_cluster)
        elif no_fat_chain:
            declared = max(1, _cluster_count(data_length, self.volume.cluster_size))
            available = max(0, self.volume.max_cluster - first_cluster + 1)
            count = min(declared, available, self.limits.max_chain_clusters)
            chain = list(range(first_cluster, first_cluster + count))
        else:
            expected = _cluster_count(data_length, self.volume.cluster_size) or None
            chain, _ = self._walk_chain(first_cluster, expected=expected)

        read_chunk = max(32, self.limits.directory_read_chunk // 32 * 32)
        for cluster_index, cluster in enumerate(chain):
            cluster_offset = self._cluster_offset(cluster)
            remaining = self.volume.cluster_size
            if not is_root and data_length:
                # Directory DataLength bounds even a valid-looking allocation run.
                remaining = min(
                    remaining,
                    max(0, data_length - cluster_index * self.volume.cluster_size),
                )
            inner_offset = 0
            while remaining >= 32:
                amount = min(remaining, read_chunk)
                block = self._read(cluster_offset + inner_offset, amount)
                for inner in range(0, len(block) - 31, 32):
                    yield cluster_offset + inner_offset + inner, block[inner:inner + 32]
                if len(block) < amount:
                    return
                remaining -= amount
                inner_offset += amount

    def _stream_allocation(
        self,
        first_cluster: int,
        data_length: int,
        valid_data_length: int,
        no_fat_chain: bool,
        *,
        directory: bool,
    ) -> tuple[list[int], list[dict[str, Any]], str, bool, bool]:
        if data_length == 0:
            return [], [], "empty", True, False
        required = _cluster_count(data_length, self.volume.cluster_size)
        valid_length = min(valid_data_length, data_length)
        if not self._valid_cluster(first_cluster):
            return [], [], "invalid_first_cluster", False, False

        chain_truncated = False
        if no_fat_chain:
            available = max(0, self.volume.max_cluster - first_cluster + 1)
            represented = min(required, available)
            report_count = min(represented, self.limits.max_chain_clusters)
            chain = list(range(first_cluster, first_cluster + report_count))
            chain_truncated = report_count < represented
            allocation_complete = represented >= required
            status = "contiguous" if allocation_complete else "out_of_range"

            physical_capacity = represented * self.volume.cluster_size
            physical_length = min(valid_length, physical_capacity)
            extents: list[dict[str, Any]] = []
            if physical_length:
                extents.append(
                    {
                        "image_offset": self._cluster_offset(first_cluster),
                        "logical_offset": 0,
                        "length": physical_length,
                        "sparse": False,
                    }
                )
        else:
            chain, status = self._walk_chain(first_cluster, expected=required)
            allocation_complete = len(chain) >= required
            chain_truncated = status == "limit"
            physical_capacity = len(chain) * self.volume.cluster_size
            physical_length = min(valid_length, physical_capacity)
            extents = self._extents(chain, physical_length)

        # Bytes beyond ValidDataLength read as zero according to exFAT semantics.
        # Only advertise that sparse tail when the allocation itself is complete.
        if allocation_complete and valid_length < data_length:
            extents.append(
                {
                    "image_offset": None,
                    "logical_offset": valid_length,
                    "length": data_length - valid_length,
                    "sparse": True,
                }
            )
        complete = allocation_complete and valid_data_length <= data_length
        if directory and valid_data_length == 0:
            # Some damaged directory streams retain DataLength but lose VDL.  Do
            # not claim complete recovery merely because the allocation is known.
            complete = False
        return chain, extents, status, complete, chain_truncated

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
            if value == 0xFFFFFFF7:
                return chain, "bad_cluster"
            if value >= 0xFFFFFFF8:
                return chain, "eoc"
            if 0xFFFFFFF0 <= value <= 0xFFFFFFF6 or value == 1:
                return chain, "reserved"
            current = value
        return chain, "limit"

    def _fat_value(self, cluster: int) -> int | None:
        relative = cluster * 4
        if relative + 4 > self.volume.fat_length:
            return None
        raw = self._read(self.volume.fat_offset + relative, 4)
        return int.from_bytes(raw, "little") if len(raw) == 4 else None

    def _valid_cluster(self, cluster: int) -> bool:
        return 2 <= cluster <= self.volume.max_cluster

    def _cluster_offset(self, cluster: int) -> int:
        return self.volume.cluster_heap_offset + (
            cluster - 2
        ) * self.volume.cluster_size

    def _extents(self, chain: list[int], logical_size: int) -> list[dict[str, Any]]:
        extents: list[dict[str, Any]] = []
        remaining = logical_size
        logical_offset = 0
        for cluster in chain:
            if remaining <= 0:
                break
            length = min(self.volume.cluster_size, remaining)
            image_offset = self._cluster_offset(cluster)
            if image_offset + length > self.volume.end_offset:
                break
            if (
                extents
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


def parse_exfat(
    reader: ImageReader,
    partition: Partition,
    *,
    limits: ExFATLimits | None = None,
) -> list[dict[str, Any]]:
    """Plugin-compatible exFAT parser that fails closed on malformed geometry."""

    try:
        return ExFATParser(reader, partition, limits=limits).enumerate_files()
    except (ExFATError, OSError, OverflowError, struct.error):
        return []


def _cluster_count(length: int, cluster_size: int) -> int:
    return (length + cluster_size - 1) // cluster_size if length else 0


def _decode_filename(records: list[bytes], length: int) -> tuple[str, bool]:
    if length == 0:
        return "", False
    encoded = b"".join(record[2:32] for record in records)
    required = length * 2
    complete = len(encoded) >= required
    return encoded[:required].decode("utf-16-le", "replace"), complete


def _entry_set_checksum(records: list[bytes], *, restore_in_use: bool) -> int:
    checksum = 0
    for record_index, record in enumerate(records):
        for byte_index, raw_value in enumerate(record):
            if record_index == 0 and byte_index in (2, 3):
                continue
            value = raw_value | 0x80 if restore_in_use and byte_index == 0 else raw_value
            checksum = (((checksum << 15) | (checksum >> 1)) + value) & 0xFFFF
    return checksum


def _timestamps(primary: bytes) -> dict[str, str | None]:
    return {
        "created": _exfat_datetime(
            struct.unpack_from("<I", primary, 8)[0], primary[20], primary[22]
        ),
        "modified": _exfat_datetime(
            struct.unpack_from("<I", primary, 12)[0], primary[21], primary[23]
        ),
        "accessed": _exfat_datetime(
            struct.unpack_from("<I", primary, 16)[0], None, primary[24]
        ),
    }


def _exfat_datetime(value: int, ten_ms: int | None, utc_raw: int) -> str | None:
    if value == 0:
        return None
    year = 1980 + ((value >> 25) & 0x7F)
    month = (value >> 21) & 0x0F
    day = (value >> 16) & 0x1F
    hour = (value >> 11) & 0x1F
    minute = (value >> 5) & 0x3F
    second = (value & 0x1F) * 2
    microsecond = 0
    if ten_ms is not None and ten_ms <= 199:
        second += ten_ms // 100
        microsecond = (ten_ms % 100) * 10_000
    tz = None
    if utc_raw & 0x80:
        quarter_hours = utc_raw & 0x7F
        if quarter_hours >= 0x40:
            quarter_hours -= 0x80
        tz = timezone(timedelta(minutes=quarter_hours * 15))
    try:
        return datetime(
            year, month, day, hour, minute, second, microsecond, tzinfo=tz
        ).isoformat()
    except ValueError:
        return None


def _clean_name(name: str) -> str:
    cleaned = "".join(
        "_" if character in ("/", "\\", "\x00") or ord(character) < 32 else character
        for character in name
    )
    return cleaned.strip()


def _join_path(parent: str, name: str) -> str:
    return f"/{name}" if parent == "/" else f"{parent.rstrip('/')}/{name}"


__all__ = [
    "ExFATError",
    "ExFATLimits",
    "ExFATParser",
    "ExFATVolume",
    "parse_exfat",
]
