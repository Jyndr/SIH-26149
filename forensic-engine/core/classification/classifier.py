"""
Content-based file classifier.

After carving, classifies recovered artifacts by actual content
rather than trusting file extensions.  Uses the format registry
to map format names to categories, MIME types, and extensions.
"""
from __future__ import annotations
from pathlib import Path
from core.types import RecoveredArtifact, FileCategory, CarvingResult, ValidationResult
from core.detection.registry import FormatRegistry
from core.integrity.hashing import hash_file


class FileClassifier:
    """Classify and enrich recovered artifacts with full metadata."""

    def __init__(self, registry: FormatRegistry):
        self.registry = registry

    def classify(
        self,
        carving_result: CarvingResult,
        validation_result: ValidationResult,
        hash_algorithms: list[str] | None = None,
    ) -> RecoveredArtifact:
        """Build a fully classified RecoveredArtifact from carving + validation results.

        Computes hashes of the recovered file and maps format → category/MIME.
        """
        if hash_algorithms is None:
            hash_algorithms = ["sha256", "md5"]

        fmt_name = validation_result.format_name
        fmt_def = self.registry.get(fmt_name)

        # Hash the carved file
        hashes = {}
        if carving_result.output_path and Path(carving_result.output_path).exists():
            hashes = hash_file(carving_result.output_path, algorithms=hash_algorithms)

        return RecoveredArtifact(
            artifact_id=carving_result.artifact_id,
            format_name=fmt_name,
            category=fmt_def.category,
            mime_type=fmt_def.mime_type,
            offset=carving_result.offset,
            size=carving_result.size,
            sha256=hashes.get("sha256", ""),
            md5=hashes.get("md5", ""),
            confidence_score=validation_result.confidence_score,
            confidence_factors=validation_result.confidence_factors,
            recovery_method="carving",
            output_path=carving_result.output_path,
            is_complete=carving_result.is_complete,
            is_fragmented=carving_result.is_fragmented,
            validation_details=validation_result.details,
        )
