"""
Shared types used across the entire forensic engine.

Forensic Concepts
-----------------
SignatureCandidate — a raw scanner hit, NOT a confirmed file.
ValidationResult  — structural check output with confidence factors.
CarvingResult     — extraction outcome with boundary info.
RecoveredArtifact — final recovered file with full metadata + hashes.
"""
from __future__ import annotations
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class FileCategory(Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    ARCHIVE = "archive"
    DATABASE = "database"
    EXECUTABLE = "executable"
    OTHER = "other"


@dataclass(frozen=True, slots=True)
class Signature:
    """A magic-byte pattern identifying a file format."""
    pattern: bytes
    offset: int = 0
    description: str = ""


@dataclass(slots=True)
class SignatureCandidate:
    """Raw signature hit from the scanner — NOT a confirmed file."""
    offset: int
    format_name: str
    signature_hex: str = ""


@dataclass(slots=True)
class ValidationResult:
    """Output of structural validation for one candidate."""
    valid: bool = False
    format_name: str = ""
    offset: int = 0
    estimated_size: int = 0
    confidence_score: float = 0.0
    confidence_factors: dict[str, float] = field(default_factory=dict)
    details: str = ""
    error: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "valid": self.valid, "type": self.format_name,
            "offset": self.offset, "estimated_size": self.estimated_size,
            "confidence_score": round(self.confidence_score, 4),
            "confidence_factors": {k: round(v, 4) for k, v in self.confidence_factors.items()},
            "details": self.details, "error": self.error,
        }


@dataclass(slots=True)
class CarvingResult:
    """Result of file carving/extraction."""
    success: bool = False
    artifact_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    format_name: str = ""
    offset: int = 0
    end_offset: int = 0
    size: int = 0
    output_path: str = ""
    is_complete: bool = True
    is_fragmented: bool = False
    error: str = ""


@dataclass(slots=True)
class RecoveredArtifact:
    """A fully recovered, validated, hashed file."""
    artifact_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    format_name: str = ""
    category: FileCategory = FileCategory.OTHER
    mime_type: str = "application/octet-stream"
    offset: int = 0
    size: int = 0
    sha256: str = ""
    md5: str = ""
    confidence_score: float = 0.0
    confidence_factors: dict[str, float] = field(default_factory=dict)
    recovery_method: str = "carving"
    output_path: str = ""
    is_complete: bool = True
    is_fragmented: bool = False
    validation_details: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "artifact_id": self.artifact_id, "format": self.format_name,
            "category": self.category.value, "mime_type": self.mime_type,
            "offset": self.offset, "size": self.size,
            "sha256": self.sha256, "md5": self.md5,
            "confidence_score": round(self.confidence_score, 4),
            "confidence_factors": {k: round(v, 4) for k, v in self.confidence_factors.items()},
            "recovery_method": self.recovery_method,
            "output_path": self.output_path,
            "is_complete": self.is_complete, "is_fragmented": self.is_fragmented,
            "validation_details": self.validation_details,
            "metadata": self.metadata,
        }
