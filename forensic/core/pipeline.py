"""End-to-end read-only forensic analysis pipeline."""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from core.carving import Carver
from core.classification.classifier import FileClassifier
from core.detection.scanner import ChunkedScanner
from core.detection.signatures import load_signatures
from core.filesystem import FileSystemAnalyzer
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


class ForensicPipeline:
    def __init__(self, config: PipelineConfig | None = None) -> None:
        self.config = config or PipelineConfig()
        if self.config.chunk_size <= 0 or self.config.max_carve_size <= 0:
            raise ValueError("Chunk and carve sizes must be positive")
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
        evidence = self.evidence_manager.register(source_path, case_id)
        self.evidence_manager.begin(evidence)
        artifacts = []
        warnings = []
        candidates_count = validated_count = 0
        try:
            with open_image(source_path) as reader:
                partitions = PartitionAnalyzer().analyze(reader)
                filesystems = [FileSystemAnalyzer().analyze(reader, p).to_dict()
                               for p in partitions.partitions]
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
                               "recovered_artifacts": len(artifacts)}, warnings)
