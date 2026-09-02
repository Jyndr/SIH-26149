"""End-to-end read-only forensic analysis pipeline."""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from core.carving import Carver
from core.classification.classifier import FileClassifier
from core.detection.scanner import ChunkedScanner
from core.detection.signatures import load_signatures
from core.filesystem import FileSystemAnalyzer
from core.filesystem.recovery import FileSystemRecoverer
from core.image_reader import open_image
from core.integrity.evidence import EvidenceManager
from core.partition import PartitionAnalyzer
from core.reporting import ForensicReport
from core.validation.validator import validate_candidate


@dataclass(frozen=True)
class PipelineConfig:
    chunk_size: int = 4 * 1024 * 1024
    max_carve_size: int = 100 * 1024 * 1024
    signatures_path: str | None = None
    scan_whole_image: bool = True
    recover_filesystem: bool = True
    recover_deleted: bool = True
    max_filesystem_file_size: int | None = None


class ForensicPipeline:
    def __init__(self, config: PipelineConfig | None = None) -> None:
        self.config = config or PipelineConfig()
        if self.config.chunk_size <= 0 or self.config.max_carve_size <= 0:
            raise ValueError("Chunk and carve sizes must be positive")
        if (self.config.max_filesystem_file_size is not None
                and self.config.max_filesystem_file_size <= 0):
            raise ValueError("Filesystem recovery size must be positive")
        self.registry = load_signatures(self.config.signatures_path)
        self.evidence_manager = EvidenceManager()

    def run(self, source: str | Path, output_dir: str | Path, case_id: str,
            progress_callback=None) -> ForensicReport:
        if not case_id or any(c in case_id for c in "/\\") or case_id in {".", ".."}:
            raise ValueError("case_id must be a non-empty path-safe identifier")
        source_path = Path(source).resolve(strict=True)
        output = Path(output_dir).resolve()
        if output == source_path.parent:
            raise ValueError("Output directory must be separate from evidence")
        result_dir = output / case_id
        (result_dir / "files_found").mkdir(parents=True, exist_ok=True)
        (result_dir / "files_recovered").mkdir(parents=True, exist_ok=True)
        evidence = self.evidence_manager.register(source_path, case_id)
        self.evidence_manager.begin(evidence)
        artifacts = []
        warnings = []
        candidates_count = validated_count = 0
        filesystem_detected = filesystem_failed = 0
        existing_detected = existing_found = existing_failed = 0
        deleted_detected = deleted_recovered = deleted_failed = 0
        filesystem_skipped = carving_suppressed = 0
        carved_artifacts = 0
        try:
            with open_image(source_path) as reader:
                partitions = PartitionAnalyzer().analyze(reader)
                filesystem_infos = [FileSystemAnalyzer().analyze(reader, partition)
                                    for partition in partitions.partitions]
                metadata_recovered_starts: set[int] = set()
                if self.config.recover_filesystem:
                    recovery_limit = (self.config.max_filesystem_file_size
                                      or self.config.max_carve_size)
                    recoverer = FileSystemRecoverer(
                        self.registry, recovery_limit, self.config.chunk_size,
                        self.config.recover_deleted)
                    for partition, info in zip(partitions.partitions, filesystem_infos):
                        warnings.extend(info.warnings)
                        try:
                            outcome = recoverer.recover(
                                reader, partition, info.type, info.entries,
                                output, case_id)
                        except Exception as exc:
                            # Metadata can be arbitrarily corrupt.  A recovery
                            # failure on one volume must leave carving available.
                            warning = (f"{info.type} filesystem recovery failed on "
                                       f"partition {partition.index}: {exc}")
                            warnings.append(warning)
                            info.warnings.append(warning)
                            failed_entries = sum(
                                not entry.get("is_directory", False)
                                for entry in info.entries)
                            failed_deleted = sum(
                                not entry.get("is_directory", False)
                                and FileSystemRecoverer._is_deleted(entry)
                                for entry in info.entries)
                            failed_existing = failed_entries - failed_deleted
                            filesystem_detected += failed_entries
                            filesystem_failed += failed_entries
                            existing_detected += failed_existing
                            existing_failed += failed_existing
                            deleted_detected += failed_deleted
                            deleted_failed += failed_deleted
                            info.metadata["recovery"] = {
                                "detected": failed_entries, "attempted": failed_entries,
                                "recovered": 0, "failed": failed_entries, "skipped": 0,
                            }
                            continue
                        artifacts.extend(outcome.artifacts)
                        warnings.extend(outcome.warnings)
                        filesystem_detected += outcome.detected
                        filesystem_failed += outcome.failed
                        filesystem_skipped += outcome.skipped
                        existing_detected += outcome.existing_detected
                        existing_found += outcome.existing_found
                        existing_failed += outcome.existing_failed
                        deleted_detected += outcome.deleted_detected
                        deleted_recovered += outcome.deleted_recovered
                        deleted_failed += outcome.deleted_failed
                        info.metadata["recovery"] = {
                            "detected": outcome.detected,
                            "attempted": outcome.attempted,
                            "existing_files_found": outcome.existing_found,
                            "deleted_files_detected": outcome.deleted_detected,
                            "recovered_deleted_files": outcome.deleted_recovered,
                            "failed": outcome.failed,
                            "skipped": outcome.skipped,
                        }
                        for artifact in outcome.artifacts:
                            if (artifact.is_complete
                                    and (artifact.metadata.get("extents")
                                         or artifact.metadata.get("data_offset") is not None
                                         or artifact.metadata.get("resident_offset") is not None)
                                    and artifact.metadata.get("allocated", False)
                                    and not artifact.metadata.get("deleted", False)):
                                metadata_recovered_starts.add(artifact.offset)
                else:
                    for info in filesystem_infos:
                        warnings.extend(info.warnings)
                filesystems = [info.to_dict() for info in filesystem_infos]
                candidates = ChunkedScanner(self.registry, self.config.chunk_size).scan(
                    reader, progress_callback)
                candidates_count = len(candidates)
                # RIFF and ZIP container signatures map to several definitions. Structural
                # validation resolves them; this key prevents carving the same bytes twice.
                accepted = set()
                recovered_ranges: dict[str, list[tuple[int, int]]] = {}
                carver = Carver(self.config.max_carve_size, self.config.chunk_size)
                classifier = FileClassifier(self.registry)
                for candidate in candidates:
                    # An intact active file already reconstructed from its
                    # allocation map should not also appear as a carved copy.
                    if candidate.offset in metadata_recovered_starts:
                        carving_suppressed += 1
                        continue
                    # Frame-based formats expose a signature at every frame.
                    # Avoid recovering candidates nested inside an artifact of
                    # the same format that was already recovered.
                    if any(start <= candidate.offset < end for start, end in
                           recovered_ranges.get(candidate.format_name, [])):
                        continue
                    result = validate_candidate(reader, candidate.offset,
                                                candidate.format_name, self.registry)
                    key = (result.offset, result.format_name)
                    if not result.valid or key in accepted:
                        continue
                    accepted.add(key)
                    validated_count += 1
                    carved = carver.carve(reader, result, output, case_id, self.registry)
                    if carved.success:
                        artifacts.append(classifier.classify(carved, result))
                        carved_artifacts += 1
                        recovered_ranges.setdefault(candidate.format_name, []).append(
                            (carved.offset, carved.end_offset))
                    else:
                        warnings.append(f"Carve failed at {result.offset}: {carved.error}")
            self.evidence_manager.finish(evidence)
        except Exception:
            self.evidence_manager.finish(evidence, failed=True)
            raise
        return ForensicReport(evidence, partitions.to_dict(), filesystems, artifacts,
                              {"signature_candidates": candidates_count,
                               "validated_candidates": validated_count,
                               "filesystem_files_detected": filesystem_detected,
                               "existing_files_detected": existing_detected,
                               "existing_files_found": existing_found,
                               "failed_existing_file_copies": existing_failed,
                               "deleted_files_detected": deleted_detected,
                               "recovered_deleted_files": deleted_recovered,
                               "failed_deleted_recoveries": deleted_failed,
                               "filesystem_files_failed": filesystem_failed,
                               "filesystem_files_skipped": filesystem_skipped,
                               "carving_candidates_suppressed": carving_suppressed,
                               "carved_artifacts": carved_artifacts,
                               "recovered_artifacts": len(artifacts)}, warnings)
