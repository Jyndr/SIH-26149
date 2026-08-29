"""Evidence lifecycle and immutable-source integrity records."""
from __future__ import annotations
import platform
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any
from core.image_reader import detect_image_type, open_image
from core.integrity.hashing import hash_reader


class EvidenceStatus(str, Enum):
    REGISTERED = "registered"
    ANALYZING = "analyzing"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclass
class EvidenceRecord:
    source_path: str
    image_type: str
    size: int
    sha256: str
    case_id: str
    acquired_at: str | None = None
    acquisition_metadata: dict[str, Any] = field(default_factory=dict)
    analysis_started_at: str | None = None
    analysis_ended_at: str | None = None
    status: EvidenceStatus = EvidenceStatus.REGISTERED
    tool: str = "forensic-engine/0.1.0"
    runtime: str = field(default_factory=platform.python_version)

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["status"] = self.status.value
        return result


class EvidenceManager:
    """Registers and verifies evidence through read-only image readers."""

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def register(self, source: str | Path, case_id: str,
                 acquisition_metadata: dict[str, Any] | None = None) -> EvidenceRecord:
        path = Path(source).resolve(strict=True)
        if not path.is_file():
            raise ValueError(f"Evidence is not a regular file: {path}")
        with open_image(path) as reader:
            size = reader.size
            sha256 = hash_reader(reader)["sha256"]
        return EvidenceRecord(str(path), detect_image_type(path), size, sha256, case_id,
                              acquisition_metadata=acquisition_metadata or {})

    def begin(self, evidence: EvidenceRecord) -> None:
        evidence.status = EvidenceStatus.ANALYZING
        evidence.analysis_started_at = self._now()

    def finish(self, evidence: EvidenceRecord, failed: bool = False) -> None:
        evidence.status = EvidenceStatus.FAILED if failed else EvidenceStatus.COMPLETE
        evidence.analysis_ended_at = self._now()

    def verify(self, evidence: EvidenceRecord) -> bool:
        with open_image(evidence.source_path) as reader:
            return reader.size == evidence.size and hash_reader(reader)["sha256"] == evidence.sha256
