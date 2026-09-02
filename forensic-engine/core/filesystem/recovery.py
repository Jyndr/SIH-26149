"""Recover files described by filesystem metadata.

Filesystem parsers deliberately only *describe* files.  This module is the
single place that turns those descriptions into output artifacts.  Keeping
the writer separate from the parsers makes it easier to audit that evidence
access remains read-only and gives every supported filesystem the same size,
path and extent validation.
"""
from __future__ import annotations

import mimetypes
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from core.detection.registry import FormatDefinition, FormatRegistry
from core.image_reader.base import ImageReader
from core.integrity.hashing import hash_file
from core.partition import Partition
from core.types import FileCategory, RecoveredArtifact


_SAFE_EXTENSION = re.compile(r"^\.[A-Za-z0-9]{1,16}$")


@dataclass
class FileSystemRecoveryResult:
    """Artifacts and counters produced for one filesystem."""

    artifacts: list[RecoveredArtifact] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    detected: int = 0
    attempted: int = 0
    failed: int = 0
    skipped: int = 0
    existing_detected: int = 0
    deleted_detected: int = 0
    existing_found: int = 0
    deleted_recovered: int = 0
    existing_failed: int = 0
    deleted_failed: int = 0


class FileSystemRecoverer:
    """Stream filesystem-described files out of an evidence reader."""

    def __init__(self, registry: FormatRegistry, max_file_size: int,
                 chunk_size: int = 1024 * 1024, recover_deleted: bool = True) -> None:
        if max_file_size <= 0 or chunk_size <= 0:
            raise ValueError("Filesystem recovery and chunk sizes must be positive")
        self.registry = registry
        self.max_file_size = max_file_size
        self.chunk_size = chunk_size
        self.recover_deleted = recover_deleted
        self._extension_map: dict[str, FormatDefinition] = {}
        for definition in registry.get_all():
            for extension in definition.extensions:
                self._extension_map.setdefault(extension.lower(), definition)

    def recover(self, reader: ImageReader, partition: Partition, fs_type: str,
                entries: Iterable[dict[str, Any]], output_dir: str | Path,
                case_id: str) -> FileSystemRecoveryResult:
        result = FileSystemRecoveryResult()
        output = Path(output_dir).resolve()
        case_dir = output / case_id
        found_dir = case_dir / "files_found"
        recovered_dir = case_dir / "files_recovered"
        found_dir.mkdir(parents=True, exist_ok=True)
        recovered_dir.mkdir(parents=True, exist_ok=True)
        # Deleted entries have investigative priority while retaining every
        # allocated entry.  Sorting is stable, so parser order is preserved
        # within each category.
        ordered_entries = sorted(
            entries,
            key=lambda item: 0 if isinstance(item, dict) and self._is_deleted(item) else 1,
        )

        for entry in ordered_entries:
            if not isinstance(entry, dict) or entry.get("is_directory", False):
                continue
            result.detected += 1
            name = str(entry.get("name") or Path(str(entry.get("path", ""))).name
                       or "unnamed")
            deleted = self._is_deleted(entry)
            if deleted:
                result.deleted_detected += 1
            else:
                result.existing_detected += 1
            if deleted and not self.recover_deleted:
                result.skipped += 1
                continue

            try:
                logical_size = int(entry.get("size", 0))
            except (TypeError, ValueError):
                logical_size = -1
            if logical_size < 0:
                result.failed += 1
                self._count_failure(result, deleted)
                result.warnings.append(
                    f"{fs_type} metadata entry {name!r} has an invalid negative size")
                continue
            if logical_size > self.max_file_size:
                result.skipped += 1
                result.warnings.append(
                    f"Skipped {fs_type} file {name!r}: metadata size {logical_size} "
                    f"exceeds configured recovery limit {self.max_file_size}")
                continue

            resident = entry.get("resident_data")
            extents = entry.get("extents") or []
            if logical_size and not isinstance(resident, (bytes, bytearray, memoryview)) \
                    and not extents:
                result.failed += 1
                self._count_failure(result, deleted)
                result.warnings.append(
                    f"Cannot recover {fs_type} file {name!r}: metadata has no data extents")
                continue

            result.attempted += 1
            artifact_id = str(uuid.uuid4())
            definition, format_name, category, mime_type, extension = self._classify(name)
            destination = recovered_dir if deleted else found_dir
            out_path = self._available_output_path(destination, name, extension)
            try:
                written, extraction_complete, extraction_warnings = self._extract(
                    reader, partition, entry, out_path, logical_size)
            except (OSError, ValueError, TypeError) as exc:
                out_path.unlink(missing_ok=True)
                result.failed += 1
                self._count_failure(result, deleted)
                result.warnings.append(f"Failed to recover {fs_type} file {name!r}: {exc}")
                continue

            if logical_size > 0 and written == 0:
                out_path.unlink(missing_ok=True)
                result.failed += 1
                self._count_failure(result, deleted)
                result.warnings.append(
                    f"Failed to recover {fs_type} file {name!r}: no file data was readable")
                continue

            entry_complete = bool(entry.get("is_complete", True))
            complete = entry_complete and extraction_complete and written == logical_size
            allocated = bool(entry.get("allocated", not deleted))
            try:
                hashes = hash_file(out_path, ["sha256", "md5"])
            except OSError as exc:
                out_path.unlink(missing_ok=True)
                result.failed += 1
                self._count_failure(result, deleted)
                result.warnings.append(
                    f"Failed to hash recovered {fs_type} file {name!r}: {exc}")
                continue
            physical_offset = self._entry_physical_offset(entry, extents)
            fragmented = bool(entry.get("is_fragmented", self._fragmented(extents)))
            confidence, factors = self._confidence(allocated, deleted, complete)
            metadata = self._artifact_metadata(
                entry, fs_type, partition.index, logical_size, extraction_warnings)
            state = "deleted" if deleted else "active"
            action = "Recovered" if deleted else "Found and copied"
            details = (f"{action} from {state} {fs_type} filesystem metadata; "
                       f"{'complete' if complete else 'partial'} allocation data")

            classification = "recovered_deleted" if deleted else "existing"
            output_folder = "files_recovered" if deleted else "files_found"

            result.artifacts.append(RecoveredArtifact(
                artifact_id=artifact_id,
                format_name=format_name,
                category=category,
                mime_type=mime_type,
                offset=physical_offset,
                size=written,
                sha256=hashes.get("sha256", ""),
                md5=hashes.get("md5", ""),
                confidence_score=confidence,
                confidence_factors=factors,
                recovery_method="filesystem",
                output_path=str(out_path),
                is_complete=complete,
                is_fragmented=fragmented,
                validation_details=details,
                classification=classification,
                output_folder=output_folder,
                report_output_path=f"{output_folder}/{out_path.name}",
                metadata=metadata,
            ))
            if deleted:
                result.deleted_recovered += 1
            else:
                result.existing_found += 1
            if extraction_warnings:
                result.warnings.extend(
                    f"{fs_type} file {name!r}: {warning}" for warning in extraction_warnings)

        return result

    @staticmethod
    def _is_deleted(entry: dict[str, Any]) -> bool:
        return any(bool(entry.get(key, False))
                   for key in ("is_deleted", "entry_deleted", "deleted"))

    @staticmethod
    def _count_failure(result: FileSystemRecoveryResult, deleted: bool) -> None:
        if deleted:
            result.deleted_failed += 1
        else:
            result.existing_failed += 1

    @staticmethod
    def _available_output_path(directory: Path, original_name: str,
                               fallback_extension: str) -> Path:
        # Filesystem names are untrusted. Preserve the metadata basename, but
        # prevent traversal/control characters and resolve duplicate names.
        name = original_name.replace("\\", "/").rsplit("/", 1)[-1]
        name = "".join(char for char in name if ord(char) >= 32 and char not in "/\\")
        if name in {"", ".", ".."}:
            name = f"unnamed{fallback_extension}"
        candidate = directory / name
        sequence = 1
        while candidate.exists():
            candidate = directory / f"{Path(name).stem}_{sequence}{Path(name).suffix}"
            sequence += 1
        return candidate

    def _extract(self, reader: ImageReader, partition: Partition,
                 entry: dict[str, Any], target: Path,
                 logical_size: int) -> tuple[int, bool, list[str]]:
        resident = entry.get("resident_data")
        warnings: list[str] = []
        if isinstance(resident, (bytes, bytearray, memoryview)):
            data = bytes(resident)[:logical_size]
            with target.open("wb") as stream:
                stream.write(data)
            complete = len(data) == logical_size
            if not complete:
                warnings.append("resident data is shorter than the recorded logical size")
            return len(data), complete, warnings

        normalized = self._normalize_extents(entry.get("extents") or [])
        complete = True
        logical_position = 0
        maximum_position = 0
        with target.open("wb") as stream:
            for logical_offset, image_offset, length, sparse in normalized:
                if logical_offset >= logical_size:
                    continue
                if logical_offset > logical_position:
                    # Preserve later extent alignment.  An unreported gap is not
                    # assumed to be valid file data, so recovery becomes partial.
                    stream.seek(logical_offset)
                    maximum_position = max(maximum_position, logical_offset)
                    complete = False
                    warnings.append(
                        f"allocation map has an unreported gap at logical offset {logical_position}")
                overlap = max(0, logical_position - logical_offset)
                if overlap >= length:
                    continue
                logical_offset += overlap
                length -= overlap
                if image_offset is not None:
                    image_offset += overlap
                wanted = min(length, logical_size - logical_offset)
                stream.seek(logical_offset)

                if sparse or image_offset is None:
                    stream.seek(wanted, 1)
                    logical_position = logical_offset + wanted
                    maximum_position = max(maximum_position, logical_position)
                    continue

                if not self._inside_partition(partition, image_offset, wanted, reader.size):
                    complete = False
                    warnings.append(
                        f"extent at image offset {image_offset} is outside the partition")
                    logical_position = logical_offset
                    continue

                remaining = wanted
                current_image_offset = image_offset
                actual = 0
                while remaining:
                    data = reader.read_at(current_image_offset,
                                          min(self.chunk_size, remaining))
                    if not data:
                        break
                    stream.write(data)
                    amount = len(data)
                    actual += amount
                    remaining -= amount
                    current_image_offset += amount
                logical_position = logical_offset + actual
                maximum_position = max(maximum_position, logical_position)
                if actual != wanted:
                    complete = False
                    warnings.append(
                        f"extent at image offset {image_offset} was short by {wanted - actual} bytes")

            if logical_position < logical_size:
                complete = False
                warnings.append(
                    f"allocation data ends {logical_size - logical_position} bytes before logical EOF")
            # A seek-only sparse final extent does not extend a file until it is
            # truncated.  Do so only as far as metadata actually described.
            stream.truncate(min(maximum_position, logical_size))

        return target.stat().st_size, complete, warnings

    @staticmethod
    def _normalize_extents(raw_extents: Iterable[Any]) -> list[tuple[int, int | None, int, bool]]:
        normalized: list[tuple[int, int | None, int, bool]] = []
        next_logical = 0
        for raw in raw_extents:
            if isinstance(raw, dict):
                logical_raw = raw.get("logical_offset", raw.get("file_offset", next_logical))
                physical_raw = raw.get(
                    "image_offset",
                    raw.get("physical_offset", raw.get("start_offset", raw.get("offset"))),
                )
                length_raw = raw.get("length", raw.get("byte_length", raw.get("size", 0)))
                sparse = bool(raw.get("sparse", physical_raw is None))
            elif isinstance(raw, (tuple, list)) and len(raw) >= 2:
                logical_raw = next_logical
                physical_raw, length_raw = raw[0], raw[1]
                sparse = physical_raw is None
            else:
                raise ValueError("invalid extent descriptor")
            logical = int(logical_raw)
            length = int(length_raw)
            physical = None if physical_raw is None else int(physical_raw)
            if logical < 0 or length < 0 or (physical is not None and physical < 0):
                raise ValueError("extent offsets and lengths must not be negative")
            if length == 0:
                continue
            normalized.append((logical, physical, length, sparse))
            next_logical = max(next_logical, logical + length)
        normalized.sort(key=lambda item: item[0])
        return normalized

    @staticmethod
    def _inside_partition(partition: Partition, offset: int, length: int,
                          image_size: int) -> bool:
        if length < 0 or offset < partition.start_offset:
            return False
        partition_end = min(image_size, partition.start_offset + partition.size)
        return offset <= partition_end and length <= partition_end - offset

    @staticmethod
    def _first_physical_offset(extents: Iterable[Any]) -> int:
        try:
            normalized = FileSystemRecoverer._normalize_extents(extents)
        except (TypeError, ValueError):
            return 0
        logical_first = sorted(normalized, key=lambda extent: extent[0])
        return next((physical for _, physical, _, sparse in logical_first
                     if physical is not None and not sparse), 0)

    @staticmethod
    def _entry_physical_offset(entry: dict[str, Any], extents: Iterable[Any]) -> int:
        resident_offset = entry.get("data_offset", entry.get("resident_offset"))
        if resident_offset is not None:
            try:
                return max(0, int(resident_offset))
            except (TypeError, ValueError):
                pass
        return FileSystemRecoverer._first_physical_offset(extents)

    @staticmethod
    def _fragmented(extents: Iterable[Any]) -> bool:
        try:
            physical = [extent for extent in FileSystemRecoverer._normalize_extents(extents)
                        if extent[1] is not None and not extent[3]]
        except (TypeError, ValueError):
            return False
        if len(physical) <= 1:
            return False
        return any(previous[1] + previous[2] != current[1]
                   for previous, current in zip(physical, physical[1:]))

    def _classify(self, name: str) -> tuple[
            FormatDefinition | None, str, FileCategory, str, str]:
        suffix = Path(name).suffix.lower()
        definition = self._extension_map.get(suffix)
        if definition:
            extension = definition.extensions[0] if definition.extensions else ".bin"
            return (definition, definition.name, definition.category,
                    definition.mime_type, extension)

        safe_extension = suffix if _SAFE_EXTENSION.fullmatch(suffix) else ".bin"
        mime_type = mimetypes.guess_type(name, strict=False)[0] or "application/octet-stream"
        format_name = suffix[1:] if _SAFE_EXTENSION.fullmatch(suffix) else "unknown"
        category = self._category_from_mime(mime_type, suffix)
        return None, format_name, category, mime_type, safe_extension

    @staticmethod
    def _category_from_mime(mime_type: str, suffix: str) -> FileCategory:
        major = mime_type.split("/", 1)[0]
        if major == "image":
            return FileCategory.IMAGE
        if major == "audio":
            return FileCategory.AUDIO
        if major == "video":
            return FileCategory.VIDEO
        if major == "text" or suffix in {
                ".doc", ".odt", ".ods", ".odp", ".xls", ".ppt", ".csv"}:
            return FileCategory.DOCUMENT
        if suffix in {".zip", ".rar", ".7z", ".gz", ".tar", ".bz2", ".xz"}:
            return FileCategory.ARCHIVE
        if suffix in {".db", ".sqlite", ".sqlite3", ".mdb"}:
            return FileCategory.DATABASE
        if suffix in {".exe", ".dll", ".com", ".elf", ".so"}:
            return FileCategory.EXECUTABLE
        return FileCategory.OTHER

    @staticmethod
    def _confidence(allocated: bool, deleted: bool,
                    complete: bool) -> tuple[float, dict[str, float]]:
        factors = {
            "filesystem_metadata": 0.50,
            "allocation_map": 0.30 if complete else 0.10,
            "active_directory_entry": 0.20 if allocated and not deleted else 0.0,
        }
        score = sum(factors.values())
        if deleted:
            # A deleted allocation chain can describe sectors that have since
            # been reused; metadata alone cannot prove content integrity.
            score = min(score, 0.80 if complete else 0.55)
        return score, factors

    @staticmethod
    def _artifact_metadata(entry: dict[str, Any], fs_type: str,
                           partition_index: int, logical_size: int,
                           extraction_warnings: list[str]) -> dict[str, Any]:
        metadata: dict[str, Any] = {
            "filesystem": fs_type,
            "partition_index": partition_index,
            "original_name": str(entry.get("name", "")),
            "original_path": str(entry.get("path", entry.get("name", ""))),
            "logical_size": logical_size,
            "allocated": bool(entry.get(
                "allocated", not FileSystemRecoverer._is_deleted(entry))),
            "deleted": FileSystemRecoverer._is_deleted(entry),
        }
        for key in (
            "id", "inode", "record_id", "record_number", "mft_record",
            "sequence_number", "parent_id", "parent_sequence", "parent_path",
            "data_offset", "resident_offset", "first_cluster",
            "allocated_size", "initialized_size", "valid_data_length",
            "attributes", "attribute_flags", "mode", "uid", "gid", "links",
            "flags", "status", "timestamps", "created_at", "modified_at",
            "changed_at", "accessed_at", "deleted_at", "metadata",
        ):
            if key in entry:
                metadata[key] = _json_safe(entry[key])
        if entry.get("extents"):
            metadata["extents"] = _json_safe(entry["extents"])
        if extraction_warnings:
            metadata["recovery_warnings"] = list(extraction_warnings)
        return metadata


def public_filesystem_entry(entry: dict[str, Any]) -> dict[str, Any]:
    """Return a report-safe metadata view without resident file contents."""
    hidden = {"resident_data", "data", "content", "reader", "extractor"}
    return {str(key): _json_safe(value) for key, value in entry.items()
            if key not in hidden and not str(key).startswith("_")}


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"byte_length": len(value)}
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, set):
        return [_json_safe(item) for item in sorted(value, key=repr)]
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except (TypeError, ValueError):
            pass
    return str(value)
