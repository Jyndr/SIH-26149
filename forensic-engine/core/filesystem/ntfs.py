"""Read-only NTFS metadata parsing and file-content helpers.

The parser deliberately has no dependency on the recovery pipeline.  Its public
plugin entry point, :func:`parse_ntfs`, follows ``FileSystemAnalyzer``'s
``(reader, partition) -> list[dict]`` contract.  Every non-resident extent uses
an absolute image offset, so callers can recover content with the existing
``ImageReader.read_at`` API.

Only on-disk metadata is interpreted; evidence is never modified.  Malformed
mapping pairs, attributes, update-sequence arrays, and out-of-partition runs are
bounded or rejected instead of being followed blindly.
"""
from __future__ import annotations

import struct
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator, Mapping, Sequence

from core.image_reader.base import ImageReader
from core.partition import Partition


FILE_SIGNATURE = b"FILE"
NTFS_OEM_ID = b"NTFS    "
ATTRIBUTE_END = 0xFFFFFFFF
ATTRIBUTE_STANDARD_INFORMATION = 0x10
ATTRIBUTE_FILE_NAME = 0x30
ATTRIBUTE_DATA = 0x80

FILE_RECORD_IN_USE = 0x0001
FILE_RECORD_DIRECTORY = 0x0002

ATTRIBUTE_COMPRESSED = 0x0001
ATTRIBUTE_ENCRYPTED = 0x4000
ATTRIBUTE_SPARSE = 0x8000

FILE_REFERENCE_MASK = (1 << 48) - 1
MAX_MFT_RECORDS = 1_000_000
MAX_ATTRIBUTES_PER_RECORD = 256
MAX_RUNS_PER_ATTRIBUTE = 4096
MAX_PATH_DEPTH = 256
MAX_RECORD_SIZE = 64 * 1024
DEFAULT_CONTENT_CHUNK_SIZE = 1024 * 1024


class NtfsFormatError(ValueError):
    """Raised when bytes cannot safely be interpreted as NTFS metadata."""


@dataclass(frozen=True, slots=True)
class NtfsBootSector:
    """Validated fields from an NTFS volume boot sector."""

    bytes_per_sector: int
    sectors_per_cluster: int
    cluster_size: int
    total_sectors: int
    mft_lcn: int
    mft_mirror_lcn: int
    file_record_size: int
    index_buffer_size: int
    volume_serial: int

    @classmethod
    def parse(cls, boot: bytes) -> "NtfsBootSector":
        if len(boot) < 80 or boot[3:11] != NTFS_OEM_ID:
            raise NtfsFormatError("not an NTFS boot sector")

        bytes_per_sector = _u16(boot, 11)
        sectors_per_cluster = boot[13]
        if bytes_per_sector not in (256, 512, 1024, 2048, 4096):
            raise NtfsFormatError("invalid NTFS bytes-per-sector value")
        if not _is_power_of_two(sectors_per_cluster) or sectors_per_cluster > 128:
            raise NtfsFormatError("invalid NTFS sectors-per-cluster value")

        cluster_size = bytes_per_sector * sectors_per_cluster
        if cluster_size > 2 * 1024 * 1024:
            raise NtfsFormatError("NTFS cluster size is unreasonably large")

        total_sectors = _u64(boot, 40)
        mft_lcn = _u64(boot, 48)
        mft_mirror_lcn = _u64(boot, 56)
        record_code = struct.unpack_from("<b", boot, 64)[0]
        index_code = struct.unpack_from("<b", boot, 68)[0]
        file_record_size = _decode_sized_clusters(record_code, cluster_size)
        index_buffer_size = _decode_sized_clusters(index_code, cluster_size)
        if (
            file_record_size < bytes_per_sector
            or file_record_size > MAX_RECORD_SIZE
            or not _is_power_of_two(file_record_size)
            or file_record_size % bytes_per_sector
        ):
            raise NtfsFormatError("invalid NTFS file-record size")
        if index_buffer_size <= 0 or index_buffer_size > 16 * 1024 * 1024:
            raise NtfsFormatError("invalid NTFS index-buffer size")

        return cls(
            bytes_per_sector=bytes_per_sector,
            sectors_per_cluster=sectors_per_cluster,
            cluster_size=cluster_size,
            total_sectors=total_sectors,
            mft_lcn=mft_lcn,
            mft_mirror_lcn=mft_mirror_lcn,
            file_record_size=file_record_size,
            index_buffer_size=index_buffer_size,
            volume_serial=_u64(boot, 72),
        )


# Upper-case alias for callers that use the filesystem's conventional spelling.
NTFSBootSector = NtfsBootSector


@dataclass(frozen=True, slots=True)
class DataRun:
    """One decoded NTFS mapping pair."""

    vcn: int
    cluster_count: int
    lcn: int | None

    @property
    def sparse(self) -> bool:
        return self.lcn is None


@dataclass(slots=True)
class _Attribute:
    type_code: int
    attribute_id: int
    name: str
    flags: int
    non_resident: bool
    value: bytes = b""
    runs: list[DataRun] = field(default_factory=list)
    start_vcn: int = 0
    last_vcn: int = 0
    allocated_size: int = 0
    real_size: int = 0
    initialized_size: int = 0
    runlist_complete: bool = True
    source_record_number: int = 0
    value_offset_in_record: int | None = None


@dataclass(frozen=True, slots=True)
class _FileName:
    parent_id: int
    parent_sequence: int
    name: str
    namespace: int
    allocated_size: int
    real_size: int
    file_attributes: int
    timestamps: dict[str, str | None]


@dataclass(slots=True)
class _Record:
    number: int
    sequence_number: int
    flags: int
    base_record_id: int | None
    base_record_sequence: int
    attributes: list[_Attribute]
    standard_timestamps: dict[str, str | None] | None = None
    standard_file_attributes: int = 0
    file_names: list[_FileName] = field(default_factory=list)
    parse_complete: bool = True

    @property
    def in_use(self) -> bool:
        return bool(self.flags & FILE_RECORD_IN_USE)

    @property
    def is_directory(self) -> bool:
        return bool(self.flags & FILE_RECORD_DIRECTORY)


def apply_usa_fixups(record: bytes, bytes_per_sector: int) -> bytes:
    """Validate and apply an NTFS update-sequence array (USA).

    NTFS replaces the last word in every sector of a multi-sector structure
    with a sequence value before writing it.  A mismatch indicates a torn or
    overwritten record and the record must not be trusted.
    """

    if len(record) < 8 or bytes_per_sector < 256:
        raise NtfsFormatError("record is too short for an update-sequence array")
    if len(record) % bytes_per_sector:
        raise NtfsFormatError("record is not sector aligned")

    usa_offset = _u16(record, 4)
    usa_count = _u16(record, 6)
    sector_count = len(record) // bytes_per_sector
    if usa_count != sector_count + 1:
        raise NtfsFormatError("invalid update-sequence array length")
    usa_size = usa_count * 2
    if usa_offset < 8 or usa_offset + usa_size > len(record):
        raise NtfsFormatError("update-sequence array lies outside the record")

    sequence = record[usa_offset:usa_offset + 2]
    if len(sequence) != 2:
        raise NtfsFormatError("missing update-sequence value")
    fixed = bytearray(record)
    for sector_index in range(1, usa_count):
        trailer = sector_index * bytes_per_sector - 2
        if record[trailer:trailer + 2] != sequence:
            raise NtfsFormatError("update-sequence mismatch")
        replacement_at = usa_offset + sector_index * 2
        fixed[trailer:trailer + 2] = record[replacement_at:replacement_at + 2]
    return bytes(fixed)


def decode_runlist(
    data: bytes,
    *,
    start_vcn: int = 0,
    max_runs: int = MAX_RUNS_PER_ATTRIBUTE,
    max_clusters: int | None = None,
) -> list[DataRun]:
    """Decode an NTFS mapping-pairs array.

    LCN offsets are signed and relative to the preceding non-sparse run.  An
    offset field of length zero represents a sparse range.
    """

    if start_vcn < 0 or max_runs <= 0:
        raise NtfsFormatError("invalid runlist bounds")
    position = 0
    current_vcn = start_vcn
    current_lcn = 0
    total_clusters = 0
    runs: list[DataRun] = []

    while position < len(data):
        header = data[position]
        position += 1
        if header == 0:
            return runs
        length_size = header & 0x0F
        offset_size = header >> 4
        if not 1 <= length_size <= 8 or offset_size > 8:
            raise NtfsFormatError("invalid mapping-pair field width")
        if position + length_size + offset_size > len(data):
            raise NtfsFormatError("truncated mapping-pairs array")
        if len(runs) >= max_runs:
            raise NtfsFormatError("mapping-pairs array exceeds run limit")

        cluster_count = int.from_bytes(
            data[position:position + length_size], "little", signed=False
        )
        position += length_size
        if cluster_count <= 0:
            raise NtfsFormatError("zero-length data run")
        total_clusters += cluster_count
        if max_clusters is not None and total_clusters > max_clusters:
            raise NtfsFormatError("mapping-pairs array exceeds cluster limit")

        if offset_size:
            delta = int.from_bytes(
                data[position:position + offset_size], "little", signed=True
            )
            position += offset_size
            current_lcn += delta
            if current_lcn < 0:
                raise NtfsFormatError("data run resolves before the volume")
            lcn: int | None = current_lcn
        else:
            lcn = None

        runs.append(DataRun(current_vcn, cluster_count, lcn))
        current_vcn += cluster_count

    # Mapping-pairs arrays are required to have a zero terminator.  Treating a
    # missing terminator as corruption avoids accepting a prefix accidentally.
    raise NtfsFormatError("unterminated mapping-pairs array")


class NtfsParser:
    """Parse NTFS MFT records into recovery-oriented metadata dictionaries."""

    def __init__(
        self,
        reader: ImageReader,
        partition: Partition,
        *,
        max_records: int = MAX_MFT_RECORDS,
    ) -> None:
        if max_records <= 0:
            raise ValueError("max_records must be positive")
        self.reader = reader
        self.partition = partition
        self.max_records = min(max_records, MAX_MFT_RECORDS)
        self.boot: NtfsBootSector | None = None
        self._mft_extents: list[dict[str, Any]] = []
        self._partition_start = partition.start_offset
        image_size = reader.size
        if (
            partition.start_offset < 0
            or partition.size <= 0
            or partition.start_offset >= image_size
        ):
            raise NtfsFormatError("partition is outside the image")
        declared_end = partition.start_offset + max(0, partition.size)
        self._partition_end = min(image_size, declared_end)
        if self._partition_end - self._partition_start < 512:
            raise NtfsFormatError("partition is too small for an NTFS boot sector")

    def parse(self) -> list[dict[str, Any]]:
        """Return active and deleted base MFT entries.

        Invalid individual records are skipped.  A corrupt boot sector or an
        unusable MFT bootstrap yields an empty list, which keeps filesystem
        metadata damage isolated from the engine's carving flow.
        """

        try:
            boot_raw = self._read_partition(0, 512)
            self.boot = NtfsBootSector.parse(boot_raw)
            if self._partition_end <= self._partition_start:
                return []
            bootstrap = self._read_bootstrap_record()
            if bootstrap is None:
                return []
            mft_data = self._unnamed_data_attributes(bootstrap)
            if not mft_data:
                return []
            mft_extents, mft_complete, mft_size, _allocated, _initialized = (
                self._assemble_nonresident_extents(mft_data)
            )
            if not mft_extents or mft_size < self.boot.file_record_size:
                return []
            self._mft_extents = mft_extents

            # Never derive an unbounded loop count from damaged on-disk sizes.
            # Only the physically mapped, initialized prefix can contain valid
            # FILE records.  This also prevents a corrupt high-VCN run from
            # turning into a million futile reads through a logical gap.
            readable_size = min(
                mft_size,
                _initialized,
                _contiguous_extent_coverage(mft_extents, allow_sparse=False),
            )
            record_count = min(
                readable_size // self.boot.file_record_size,
                self.max_records,
            )
            if record_count <= 0:
                return []

            records: dict[int, _Record] = {}
            for number in range(record_count):
                raw = self._read_stream(
                    mft_extents,
                    number * self.boot.file_record_size,
                    self.boot.file_record_size,
                )
                if raw is None or raw[:4] != FILE_SIGNATURE:
                    continue
                try:
                    record = self._parse_record(raw, number)
                except (NtfsFormatError, struct.error, UnicodeError):
                    continue
                records[number] = record

            if not records:
                return []
            self._merge_extension_records(records)
            entries = self._make_entries(records)
            if not mft_complete:
                for entry in entries:
                    entry["metadata"]["mft_stream_complete"] = False
            return entries
        except (NtfsFormatError, struct.error, OverflowError):
            return []

    def _read_bootstrap_record(self) -> _Record | None:
        assert self.boot is not None
        for lcn in (self.boot.mft_lcn, self.boot.mft_mirror_lcn):
            relative = lcn * self.boot.cluster_size
            raw = self._read_partition(relative, self.boot.file_record_size)
            if len(raw) != self.boot.file_record_size or raw[:4] != FILE_SIGNATURE:
                continue
            try:
                return self._parse_record(raw, 0)
            except (NtfsFormatError, struct.error, UnicodeError):
                continue
        return None

    def _parse_record(self, raw: bytes, expected_number: int) -> _Record:
        assert self.boot is not None
        if len(raw) != self.boot.file_record_size or raw[:4] != FILE_SIGNATURE:
            raise NtfsFormatError("invalid FILE record")
        fixed = apply_usa_fixups(raw, self.boot.bytes_per_sector)
        sequence_number = _u16(fixed, 16)
        first_attribute = _u16(fixed, 20)
        flags = _u16(fixed, 22)
        bytes_in_use = _u32(fixed, 24)
        base_reference = _u64(fixed, 32)

        if (
            first_attribute < 48
            or first_attribute >= len(fixed)
            or first_attribute % 8
            or bytes_in_use < first_attribute + 4
            or bytes_in_use > len(fixed)
        ):
            raise NtfsFormatError("invalid FILE record bounds")

        header_number = _u32(fixed, 44) if len(fixed) >= 48 else expected_number
        # Old NTFS versions did not populate the header record number.  The MFT
        # stream position remains authoritative in either case.
        if header_number not in (0, expected_number):
            raise NtfsFormatError("MFT record number does not match its stream position")

        attributes, parse_complete = self._parse_attributes(
            fixed, first_attribute, bytes_in_use
        )
        for attribute in attributes:
            attribute.source_record_number = expected_number
        record = _Record(
            number=expected_number,
            sequence_number=sequence_number,
            flags=flags,
            base_record_id=(base_reference & FILE_REFERENCE_MASK) if base_reference else None,
            base_record_sequence=(base_reference >> 48) & 0xFFFF,
            attributes=attributes,
            parse_complete=parse_complete,
        )
        self._decode_record_metadata(record)
        return record

    def _parse_attributes(
        self, record: bytes, start: int, bytes_in_use: int
    ) -> tuple[list[_Attribute], bool]:
        assert self.boot is not None
        attributes: list[_Attribute] = []
        position = start
        complete = True

        for _ in range(MAX_ATTRIBUTES_PER_RECORD):
            if position + 4 > bytes_in_use:
                return attributes, False
            type_code = _u32(record, position)
            if type_code == ATTRIBUTE_END:
                return attributes, complete
            if position + 16 > bytes_in_use:
                return attributes, False

            length = _u32(record, position + 4)
            non_resident = record[position + 8]
            name_length = record[position + 9]
            name_offset = _u16(record, position + 10)
            flags = _u16(record, position + 12)
            attribute_id = _u16(record, position + 14)
            minimum = 64 if non_resident else 24
            if (
                non_resident not in (0, 1)
                or length < minimum
                or length % 8
                or position + length > bytes_in_use
            ):
                return attributes, False

            attribute_bytes = record[position:position + length]
            name = ""
            if name_length:
                name_end = name_offset + name_length * 2
                if name_offset < minimum or name_end > length:
                    return attributes, False
                name = attribute_bytes[name_offset:name_end].decode(
                    "utf-16-le", "replace"
                ).rstrip("\x00")

            if not non_resident:
                value_length = _u32(attribute_bytes, 16)
                value_offset = _u16(attribute_bytes, 20)
                if value_offset < 24 or value_offset + value_length > length:
                    return attributes, False
                attributes.append(
                    _Attribute(
                        type_code=type_code,
                        attribute_id=attribute_id,
                        name=name,
                        flags=flags,
                        non_resident=False,
                        value=attribute_bytes[value_offset:value_offset + value_length],
                        allocated_size=value_length,
                        real_size=value_length,
                        initialized_size=value_length,
                        value_offset_in_record=position + value_offset,
                    )
                )
            else:
                start_vcn = _u64(attribute_bytes, 16)
                last_vcn = _u64(attribute_bytes, 24)
                run_offset = _u16(attribute_bytes, 32)
                allocated_size = _u64(attribute_bytes, 40)
                real_size = _u64(attribute_bytes, 48)
                initialized_size = _u64(attribute_bytes, 56)
                if last_vcn < start_vcn or run_offset < 64 or run_offset >= length:
                    return attributes, False

                expected_clusters = last_vcn - start_vcn + 1
                # A single record cannot legitimately describe more physical
                # clusters than the volume plus a bounded sparse address space.
                volume_clusters = max(1, self.partition.size // self.boot.cluster_size)
                cluster_limit = max(volume_clusters * 1024, expected_clusters)
                runlist_complete = True
                try:
                    runs = decode_runlist(
                        attribute_bytes[run_offset:],
                        start_vcn=start_vcn,
                        max_clusters=cluster_limit,
                    )
                except NtfsFormatError:
                    runs = []
                    runlist_complete = False
                described = sum(run.cluster_count for run in runs)
                if described != expected_clusters:
                    runlist_complete = False
                if initialized_size > real_size or real_size > (1 << 63):
                    runlist_complete = False

                attributes.append(
                    _Attribute(
                        type_code=type_code,
                        attribute_id=attribute_id,
                        name=name,
                        flags=flags,
                        non_resident=True,
                        runs=runs,
                        start_vcn=start_vcn,
                        last_vcn=last_vcn,
                        allocated_size=allocated_size,
                        real_size=real_size,
                        initialized_size=min(initialized_size, real_size),
                        runlist_complete=runlist_complete,
                    )
                )

            position += length

        return attributes, False

    def _decode_record_metadata(self, record: _Record) -> None:
        for attribute in record.attributes:
            if attribute.non_resident:
                continue
            if attribute.type_code == ATTRIBUTE_STANDARD_INFORMATION:
                if len(attribute.value) >= 36 and record.standard_timestamps is None:
                    record.standard_timestamps = _timestamps_from_value(attribute.value, 0)
                    record.standard_file_attributes = _u32(attribute.value, 32)
            elif attribute.type_code == ATTRIBUTE_FILE_NAME:
                file_name = _decode_file_name(attribute.value)
                if file_name is not None:
                    record.file_names.append(file_name)

    @staticmethod
    def _unnamed_data_attributes(record: _Record) -> list[_Attribute]:
        return [
            attribute
            for attribute in record.attributes
            if attribute.type_code == ATTRIBUTE_DATA and not attribute.name
        ]

    def _merge_extension_records(self, records: dict[int, _Record]) -> None:
        for record in list(records.values()):
            if record.base_record_id is None or record.base_record_id == record.number:
                continue
            base = records.get(record.base_record_id)
            if base is None:
                continue
            if record.base_record_sequence and record.base_record_sequence != base.sequence_number:
                continue
            base.attributes.extend(record.attributes)
            base.parse_complete = base.parse_complete and record.parse_complete
            if base.standard_timestamps is None and record.standard_timestamps is not None:
                base.standard_timestamps = record.standard_timestamps
                base.standard_file_attributes = record.standard_file_attributes
            base.file_names.extend(record.file_names)

    def _make_entries(self, records: dict[int, _Record]) -> list[dict[str, Any]]:
        base_records = {
            number: record
            for number, record in records.items()
            if record.base_record_id is None or record.base_record_id == number
        }
        preferred_names = {
            number: _preferred_file_name(record.file_names)
            for number, record in base_records.items()
        }
        paths = self._resolve_paths(base_records, preferred_names)
        entries: list[dict[str, Any]] = []

        for number in sorted(base_records):
            record = base_records[number]
            file_name = preferred_names[number]
            if file_name is None:
                continue

            data_attributes = self._unnamed_data_attributes(record)
            resident_data: bytes | None = None
            resident: _Attribute | None = None
            extents: list[dict[str, Any]] = []
            is_resident = False
            data_complete = record.parse_complete
            data_flags = 0
            allocated_size = file_name.allocated_size
            initialized_size = file_name.real_size
            size = 0 if record.is_directory else file_name.real_size

            if data_attributes:
                data_flags = 0
                for attribute in data_attributes:
                    data_flags |= attribute.flags
                resident = next(
                    (attribute for attribute in data_attributes if not attribute.non_resident),
                    None,
                )
                non_resident = [
                    attribute for attribute in data_attributes if attribute.non_resident
                ]
                if resident is not None and not non_resident:
                    resident_data = resident.value
                    is_resident = True
                    size = len(resident.value)
                    allocated_size = len(resident.value)
                    initialized_size = len(resident.value)
                elif non_resident:
                    (
                        extents,
                        extent_complete,
                        size,
                        allocated_size,
                        initialized_size,
                    ) = self._assemble_nonresident_extents(non_resident)
                    data_complete = data_complete and extent_complete
                    if resident is not None:
                        data_complete = False
                else:
                    data_complete = False
            elif not record.is_directory and size:
                data_complete = False

            unsupported = []
            if data_flags & ATTRIBUTE_COMPRESSED:
                unsupported.append("compressed")
            if data_flags & ATTRIBUTE_ENCRYPTED:
                unsupported.append("encrypted")
            if unsupported:
                data_complete = False

            non_sparse_extents = [e for e in extents if not e["sparse"]]
            is_fragmented = any(
                previous["image_offset"] + previous["length"]
                != current["image_offset"]
                for previous, current in zip(
                    non_sparse_extents, non_sparse_extents[1:]
                )
            )
            timestamps = {
                key: (
                    (record.standard_timestamps or {}).get(key)
                    or file_name.timestamps.get(key)
                )
                for key in ("created", "modified", "mft_changed", "accessed")
            }
            hard_links = [
                {
                    "parent_id": name.parent_id,
                    "parent_sequence": name.parent_sequence,
                    "name": name.name,
                    "namespace": name.namespace,
                }
                for name in record.file_names
            ]
            first_offset = next(
                (extent["image_offset"] for extent in extents if not extent["sparse"]),
                None,
            )
            data_offset = None
            if resident is not None and resident.value_offset_in_record is not None:
                mft_logical_offset = (
                    resident.source_record_number * self.boot.file_record_size
                    + resident.value_offset_in_record
                )
                data_offset = self._stream_physical_offset(
                    self._mft_extents, mft_logical_offset
                )
            entry: dict[str, Any] = {
                "filesystem": "ntfs",
                "id": number,
                "inode": number,
                "record_number": number,
                "sequence_number": record.sequence_number,
                "parent_id": file_name.parent_id,
                "parent_sequence": file_name.parent_sequence,
                "name": file_name.name,
                "path": paths.get(number, _orphan_path(file_name.name)),
                "is_directory": record.is_directory,
                "is_deleted": not record.in_use,
                "allocated": record.in_use,
                "status": "allocated" if record.in_use else "deleted",
                "size": size,
                "allocated_size": allocated_size,
                "initialized_size": initialized_size,
                "offset": first_offset if first_offset is not None else data_offset,
                "data_offset": data_offset,
                "is_resident": is_resident,
                "extents": extents,
                "is_complete": data_complete,
                "is_fragmented": is_fragmented,
                "created_at": timestamps.get("created"),
                "modified_at": timestamps.get("modified"),
                "changed_at": timestamps.get("mft_changed"),
                "accessed_at": timestamps.get("accessed"),
                "timestamps": timestamps,
                "recovery_method": "filesystem",
                "metadata": {
                    "mft_record": number,
                    "file_record_flags": record.flags,
                    "file_attributes": (
                        record.standard_file_attributes or file_name.file_attributes
                    ),
                    "namespace": file_name.namespace,
                    "hard_links": hard_links,
                    "data_attribute_flags": data_flags,
                    "unsupported_data_features": unsupported,
                    "mft_stream_complete": True,
                },
            }
            if resident_data is not None:
                entry["resident_data"] = resident_data
            entries.append(entry)
        return entries

    def _assemble_nonresident_extents(
        self, attributes: Sequence[_Attribute]
    ) -> tuple[list[dict[str, Any]], bool, int, int, int]:
        assert self.boot is not None
        ordered = sorted(attributes, key=lambda attribute: attribute.start_vcn)
        primary = next((a for a in ordered if a.start_vcn == 0), None)
        if primary is None:
            # Size fields are authoritative only in the lowest-VCN extent.
            real_size = max((a.real_size for a in ordered), default=0)
            allocated_size = max((a.allocated_size for a in ordered), default=0)
            initialized_size = max((a.initialized_size for a in ordered), default=0)
        else:
            real_size = primary.real_size
            allocated_size = primary.allocated_size
            initialized_size = primary.initialized_size
        initialized_size = min(initialized_size, real_size)
        complete = all(attribute.runlist_complete for attribute in ordered)
        extents: list[dict[str, Any]] = []

        expected_vcn = 0
        for attribute in ordered:
            if attribute.start_vcn != expected_vcn:
                complete = False
            for run in attribute.runs:
                logical_offset = run.vcn * self.boot.cluster_size
                run_length = run.cluster_count * self.boot.cluster_size
                if logical_offset >= real_size:
                    continue
                run_length = min(run_length, real_size - logical_offset)
                if run_length <= 0:
                    continue

                # Bytes beyond initialized_size read as logical zeroes on NTFS.
                initialized_length = max(
                    0, min(run_length, initialized_size - logical_offset)
                )
                if initialized_length:
                    if run.sparse:
                        extents.append(
                            _extent(None, logical_offset, initialized_length, True)
                        )
                    else:
                        physical = self._partition_start + run.lcn * self.boot.cluster_size
                        available = max(0, self._partition_end - physical)
                        valid_length = min(initialized_length, available)
                        if physical < self._partition_start or valid_length <= 0:
                            complete = False
                        else:
                            extents.append(
                                _extent(physical, logical_offset, valid_length, False)
                            )
                            if valid_length != initialized_length:
                                complete = False
                if initialized_length < run_length:
                    extents.append(
                        _extent(
                            None,
                            logical_offset + initialized_length,
                            run_length - initialized_length,
                            True,
                        )
                    )
            expected_vcn = max(expected_vcn, attribute.last_vcn + 1)

        extents.sort(key=lambda extent: extent["logical_offset"])
        complete = complete and _extents_cover(extents, real_size)
        return extents, complete, real_size, allocated_size, initialized_size

    def _resolve_paths(
        self,
        records: Mapping[int, _Record],
        names: Mapping[int, _FileName | None],
    ) -> dict[int, str]:
        cache: dict[int, str] = {}

        def resolve(number: int, ancestors: frozenset[int]) -> str:
            if number in cache:
                return cache[number]
            name = names.get(number)
            if name is None:
                return "/$OrphanFiles"
            if number == 5 or (name.name == "." and name.parent_id == number):
                cache[number] = "/"
                return "/"
            if number in ancestors or len(ancestors) >= MAX_PATH_DEPTH:
                path = _orphan_path(name.name)
                cache[number] = path
                return path

            parent = records.get(name.parent_id)
            parent_name = names.get(name.parent_id)
            if (
                parent is None
                or parent_name is None
                or name.parent_id == number
                or (
                    name.parent_sequence
                    and parent.sequence_number != name.parent_sequence
                )
            ):
                path = _orphan_path(name.name)
                cache[number] = path
                return path

            parent_path = resolve(name.parent_id, ancestors | {number})
            if number in cache:
                return cache[number]
            path = (
                f"/{name.name}"
                if parent_path == "/"
                else f"{parent_path.rstrip('/')}/{name.name}"
            )
            cache[number] = path
            return path

        for number in records:
            resolve(number, frozenset())
        return cache

    def _read_partition(self, relative_offset: int, size: int) -> bytes:
        if relative_offset < 0 or size < 0:
            return b""
        absolute = self._partition_start + relative_offset
        if absolute < self._partition_start or absolute >= self._partition_end:
            return b""
        bounded_size = min(size, self._partition_end - absolute)
        return self.reader.read_at(absolute, bounded_size)

    def _read_stream(
        self,
        extents: Sequence[Mapping[str, Any]],
        logical_offset: int,
        size: int,
    ) -> bytes | None:
        if logical_offset < 0 or size < 0:
            return None
        end = logical_offset + size
        cursor = logical_offset
        chunks: list[bytes] = []
        for extent in extents:
            extent_start = int(extent["logical_offset"])
            extent_end = extent_start + int(extent["length"])
            if extent_end <= cursor:
                continue
            if extent_start > cursor:
                return None
            take_end = min(extent_end, end)
            take = take_end - cursor
            if take <= 0:
                continue
            if extent["sparse"]:
                # The MFT itself must never be sparse.  Keep this general helper
                # conservative rather than manufacturing FILE records from zeroes.
                return None
            physical = int(extent["image_offset"]) + (cursor - extent_start)
            chunk = self.reader.read_at(physical, take)
            if len(chunk) != take:
                return None
            chunks.append(chunk)
            cursor = take_end
            if cursor == end:
                return b"".join(chunks)
        return None

    @staticmethod
    def _stream_physical_offset(
        extents: Sequence[Mapping[str, Any]], logical_offset: int
    ) -> int | None:
        for extent in extents:
            start = int(extent["logical_offset"])
            end = start + int(extent["length"])
            if start <= logical_offset < end:
                if extent["sparse"] or extent["image_offset"] is None:
                    return None
                return int(extent["image_offset"]) + logical_offset - start
        return None


# Conventional all-caps class alias.
NTFSParser = NtfsParser


def parse_ntfs(reader: ImageReader, partition: Partition) -> list[dict[str, Any]]:
    """Filesystem-analyzer plugin entry point for NTFS."""

    try:
        return NtfsParser(reader, partition).parse()
    except (NtfsFormatError, OSError, OverflowError, struct.error):
        return []


def iter_ntfs_file_content(
    reader: ImageReader,
    entry: Mapping[str, Any],
    *,
    chunk_size: int = DEFAULT_CONTENT_CHUNK_SIZE,
) -> Iterator[bytes]:
    """Yield a parsed entry's logical bytes without loading the file at once.

    Resident values are emitted directly.  Sparse and uninitialized extents are
    returned as zeroes.  Missing logical coverage is an error; callers therefore
    cannot mistake a partially parsed corrupt runlist for a complete recovery.
    """

    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    size = int(entry.get("size", 0))
    if size < 0:
        raise NtfsFormatError("negative file size")
    if entry.get("is_directory"):
        return

    resident = entry.get("resident_data")
    if resident is not None:
        data = bytes(resident)
        if len(data) < size:
            raise NtfsFormatError("resident value is shorter than the file size")
        for position in range(0, size, chunk_size):
            yield data[position:min(size, position + chunk_size)]
        return

    cursor = 0
    extents = sorted(
        entry.get("extents", []), key=lambda extent: int(extent["logical_offset"])
    )
    for extent in extents:
        logical = int(extent["logical_offset"])
        length = int(extent["length"])
        if length <= 0 or logical >= size:
            continue
        if logical != cursor:
            raise NtfsFormatError("file extents do not provide contiguous coverage")
        length = min(length, size - logical)
        if extent.get("sparse", False):
            remaining = length
            zero_chunk = b"\x00" * min(chunk_size, remaining)
            while remaining:
                take = min(remaining, chunk_size)
                yield zero_chunk[:take]
                remaining -= take
        else:
            image_offset = extent.get("image_offset")
            if image_offset is None:
                raise NtfsFormatError("non-sparse extent has no image offset")
            remaining = length
            physical = int(image_offset)
            while remaining:
                take = min(remaining, chunk_size)
                data = reader.read_at(physical, take)
                if len(data) != take:
                    raise NtfsFormatError("short read while recovering an NTFS extent")
                yield data
                physical += take
                remaining -= take
        cursor += length
        if cursor == size:
            return
    if cursor != size:
        raise NtfsFormatError("file extents do not cover the declared file size")


def read_ntfs_file_content(
    reader: ImageReader,
    entry: Mapping[str, Any],
    *,
    max_bytes: int | None = None,
) -> bytes:
    """Return a parsed entry's content, optionally enforcing a memory bound."""

    size = int(entry.get("size", 0))
    if max_bytes is not None and (max_bytes < 0 or size > max_bytes):
        raise ValueError("file exceeds max_bytes")
    return b"".join(iter_ntfs_file_content(reader, entry))


def _decode_file_name(value: bytes) -> _FileName | None:
    if len(value) < 66:
        return None
    name_length = value[64]
    namespace = value[65]
    name_end = 66 + name_length * 2
    if namespace > 3 or name_end > len(value):
        return None
    name = value[66:name_end].decode("utf-16-le", "replace").rstrip("\x00")
    if not name:
        return None
    parent_reference = _u64(value, 0)
    return _FileName(
        parent_id=parent_reference & FILE_REFERENCE_MASK,
        parent_sequence=(parent_reference >> 48) & 0xFFFF,
        name=name,
        namespace=namespace,
        allocated_size=_u64(value, 40),
        real_size=_u64(value, 48),
        file_attributes=_u32(value, 56),
        timestamps=_timestamps_from_value(value, 8),
    )


def _preferred_file_name(names: Sequence[_FileName]) -> _FileName | None:
    # WIN32_AND_DOS, WIN32, POSIX, DOS.  Preserve attribute order among equal
    # ranks because it normally reflects the primary hard link.
    rank = {3: 0, 1: 1, 0: 2, 2: 3}
    return min(names, key=lambda item: rank.get(item.namespace, 4), default=None)


def _timestamps_from_value(value: bytes, offset: int) -> dict[str, str | None]:
    return {
        "created": _filetime_to_iso(_u64(value, offset)),
        "modified": _filetime_to_iso(_u64(value, offset + 8)),
        "mft_changed": _filetime_to_iso(_u64(value, offset + 16)),
        "accessed": _filetime_to_iso(_u64(value, offset + 24)),
    }


def _filetime_to_iso(value: int) -> str | None:
    if value == 0:
        return None
    try:
        result = datetime(1601, 1, 1, tzinfo=timezone.utc) + timedelta(
            microseconds=value // 10
        )
    except (OverflowError, ValueError):
        return None
    return result.isoformat().replace("+00:00", "Z")


def _decode_sized_clusters(code: int, cluster_size: int) -> int:
    if code == 0:
        raise NtfsFormatError("zero-sized NTFS structure")
    if code < 0:
        exponent = -code
        if exponent > 30:
            raise NtfsFormatError("NTFS structure-size exponent is too large")
        return 1 << exponent
    return code * cluster_size


def _extent(
    image_offset: int | None,
    logical_offset: int,
    length: int,
    sparse: bool,
) -> dict[str, Any]:
    return {
        "image_offset": image_offset,
        "logical_offset": logical_offset,
        "length": length,
        "sparse": sparse,
    }


def _extents_cover(extents: Sequence[Mapping[str, Any]], size: int) -> bool:
    if size == 0:
        return True
    cursor = 0
    for extent in sorted(extents, key=lambda item: int(item["logical_offset"])):
        logical = int(extent["logical_offset"])
        length = int(extent["length"])
        if length <= 0:
            continue
        if logical != cursor:
            return False
        cursor += length
        if cursor >= size:
            return cursor == size
    return False


def _contiguous_extent_coverage(
    extents: Sequence[Mapping[str, Any]], *, allow_sparse: bool
) -> int:
    """Return the size of the gap-free logical prefix represented by extents."""

    cursor = 0
    for extent in sorted(extents, key=lambda item: int(item["logical_offset"])):
        logical = int(extent["logical_offset"])
        length = int(extent["length"])
        if length <= 0:
            continue
        if logical != cursor or (extent.get("sparse", False) and not allow_sparse):
            break
        cursor += length
    return cursor


def _orphan_path(name: str) -> str:
    return f"/$OrphanFiles/{name}"


def _is_power_of_two(value: int) -> bool:
    return value > 0 and value & (value - 1) == 0


def _u16(data: bytes, offset: int) -> int:
    return struct.unpack_from("<H", data, offset)[0]


def _u32(data: bytes, offset: int) -> int:
    return struct.unpack_from("<I", data, offset)[0]


def _u64(data: bytes, offset: int) -> int:
    return struct.unpack_from("<Q", data, offset)[0]


__all__ = [
    "DataRun",
    "NTFSBootSector",
    "NTFSParser",
    "NtfsBootSector",
    "NtfsFormatError",
    "NtfsParser",
    "apply_usa_fixups",
    "decode_runlist",
    "iter_ntfs_file_content",
    "parse_ntfs",
    "read_ntfs_file_content",
]
