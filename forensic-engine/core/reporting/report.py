"""Deterministic JSON forensic reports."""
from __future__ import annotations
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from core.integrity.evidence import EvidenceRecord
from core.types import RecoveredArtifact


@dataclass
class ForensicReport:
    evidence: EvidenceRecord
    partitions: dict[str, Any]
    filesystems: list[dict[str, Any]]
    artifacts: list[RecoveredArtifact]
    statistics: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {"schema_version": "1.0", "evidence": self.evidence.to_dict(),
                "partition_analysis": self.partitions, "filesystem_analysis": self.filesystems,
                "artifacts": [a.to_dict() for a in self.artifacts],
                "statistics": self.statistics, "warnings": self.warnings}

    def write_json(self, path: str | Path) -> Path:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(self.to_dict(), indent=2, sort_keys=True), encoding="utf-8")
        return target
