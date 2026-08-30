"""
File carving strategies.

Carver takes a validated candidate and extracts the file bytes from
the evidence image to a separate output directory (never beside evidence).

CarvingStrategy (ABC)
├── ContiguousCarver   — header-to-footer extraction
├── StructuredCarver   — format-aware boundary detection
└── ContainerCarver    — ZIP/Office container extraction
"""
from __future__ import annotations
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from core.types import CarvingResult, ValidationResult
from core.image_reader.base import ImageReader
from core.detection.registry import FormatRegistry

_DEFAULT_MAX_CARVE = 100 * 1024 * 1024  # 100 MB default max carve


class CarvingStrategy(ABC):
    """Abstract carving strategy."""

    @abstractmethod
    def carve(
        self,
        reader: ImageReader,
        candidate: ValidationResult,
        output_dir: Path,
        case_id: str,
        registry: FormatRegistry,
    ) -> CarvingResult:
        """Extract the file from the evidence image.

        Writes the recovered file to output_dir/<case_id>/<artifact_id>.<ext>
        Returns a CarvingResult with success/failure and metadata.
        """


class ContiguousCarver(CarvingStrategy):
    """Extract contiguous files using offset + estimated size.

    This is the simplest and most common strategy:
    read from start_offset for estimated_size bytes.
    """

    def __init__(self, max_carve_size: int = _DEFAULT_MAX_CARVE, chunk_size: int = 1024 * 1024):
        self.max_carve_size = max_carve_size
        self.chunk_size = chunk_size

    def carve(
        self,
        reader: ImageReader,
        candidate: ValidationResult,
        output_dir: Path,
        case_id: str,
        registry: FormatRegistry,
    ) -> CarvingResult:
        artifact_id = str(uuid.uuid4())
        fmt_def = registry.get(candidate.format_name)
        ext = fmt_def.extensions[0] if fmt_def.extensions else ".bin"

        # A validated header is not sufficient evidence of a complete file.
        # Never turn an unknown boundary into a max-sized artifact: doing so
        # creates large false positives from isolated signatures in disk data.
        carve_size = candidate.estimated_size
        if carve_size <= 0:
            return CarvingResult(
                success=False, artifact_id=artifact_id,
                format_name=candidate.format_name, offset=candidate.offset,
                error="Validator did not establish a file boundary",
            )
        if carve_size > self.max_carve_size:
            return CarvingResult(
                success=False, artifact_id=artifact_id,
                format_name=candidate.format_name, offset=candidate.offset,
                error=(f"Validated size {carve_size} exceeds configured carve limit "
                       f"{self.max_carve_size}"),
            )

        # Also clamp to available data
        available = reader.size - candidate.offset
        carve_size = min(carve_size, available)

        if carve_size <= 0:
            return CarvingResult(success=False, artifact_id=artifact_id,
                                 format_name=candidate.format_name,
                                 offset=candidate.offset, error="No data to carve")

        # Create output path
        case_dir = output_dir / case_id
        case_dir.mkdir(parents=True, exist_ok=True)
        out_path = case_dir / f"{artifact_id}{ext}"

        # Stream carve in chunks (bounded memory)
        reader.seek(candidate.offset)
        bytes_written = 0
        try:
            with open(out_path, "wb") as f:
                remaining = carve_size
                while remaining > 0:
                    to_read = min(self.chunk_size, remaining)
                    data = reader.read(to_read)
                    if not data:
                        break
                    f.write(data)
                    bytes_written += len(data)
                    remaining -= len(data)
        except IOError as exc:
            return CarvingResult(success=False, artifact_id=artifact_id,
                                 format_name=candidate.format_name,
                                 offset=candidate.offset,
                                 error=f"Write error: {exc}")

        return CarvingResult(
            success=True,
            artifact_id=artifact_id,
            format_name=candidate.format_name,
            offset=candidate.offset,
            end_offset=candidate.offset + bytes_written,
            size=bytes_written,
            output_path=str(out_path),
            is_complete=bytes_written == candidate.estimated_size,
        )


class StructuredCarver(ContiguousCarver):
    """Carve boundaries calculated by a structure-aware validator."""


class ContainerCarver(StructuredCarver):
    """Carve a validated container through its calculated terminal record."""


class Carver:
    """Registry-driven carving strategy dispatcher."""

    def __init__(self, max_carve_size: int = _DEFAULT_MAX_CARVE,
                 chunk_size: int = 1024 * 1024) -> None:
        args = (max_carve_size, chunk_size)
        self.strategies: dict[str, CarvingStrategy] = {
            "contiguous": ContiguousCarver(*args),
            "structured": StructuredCarver(*args),
            "container": ContainerCarver(*args),
        }

    def register(self, name: str, strategy: CarvingStrategy) -> None:
        self.strategies[name] = strategy

    def carve(self, reader: ImageReader, candidate: ValidationResult,
              output_dir: str | Path, case_id: str,
              registry: FormatRegistry) -> CarvingResult:
        output = Path(output_dir).resolve()
        source = getattr(reader, "path", None)
        if source and output == Path(source).resolve().parent:
            raise ValueError("Recovery output must not be the evidence directory")
        strategy_name = registry.get(candidate.format_name).carving_strategy
        strategy = self.strategies.get(strategy_name)
        if strategy is None:
            return CarvingResult(format_name=candidate.format_name,
                                 offset=candidate.offset,
                                 error=f"Unknown carving strategy: {strategy_name}")
        return strategy.carve(reader, candidate, output, case_id, registry)
