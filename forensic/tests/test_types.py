"""
Tests for core.types — shared enums and dataclasses.
"""

from core.types import (
    FileCategory,
    Signature,
    SignatureCandidate,
    ValidationResult,
    RecoveredArtifact,
)


# ---------------------------------------------------------------------------
# FileCategory enum
# ---------------------------------------------------------------------------

class TestFileCategory:
    """Verify that all expected categories exist and serialize correctly."""

    def test_all_categories_exist(self):
        expected = {
            "image", "video", "audio", "document",
            "archive", "database", "executable", "other",
        }
        actual = {cat.value for cat in FileCategory}
        assert actual == expected

    def test_category_from_value(self):
        assert FileCategory("image") is FileCategory.IMAGE
        assert FileCategory("video") is FileCategory.VIDEO

    def test_category_value(self):
        assert FileCategory.DOCUMENT.value == "document"
        assert FileCategory.ARCHIVE.value == "archive"


# ---------------------------------------------------------------------------
# Signature
# ---------------------------------------------------------------------------

class TestSignature:
    """Verify Signature dataclass behavior."""

    def test_creation(self):
        sig = Signature(b"\xFF\xD8\xFF", offset=0, description="JPEG SOI")
        assert sig.pattern == b"\xFF\xD8\xFF"
        assert sig.offset == 0
        assert sig.description == "JPEG SOI"

    def test_default_offset(self):
        sig = Signature(b"PK\x03\x04")
        assert sig.offset == 0
        assert sig.description == ""

    def test_frozen(self):
        """Signatures must be immutable (forensic integrity)."""
        sig = Signature(b"\xFF\xD8\xFF")
        try:
            sig.pattern = b"\x00"
            assert False, "Should have raised FrozenInstanceError"
        except AttributeError:
            pass  # Expected — frozen dataclass

    def test_equality(self):
        a = Signature(b"\xFF\xD8\xFF", offset=0, description="JPEG")
        b = Signature(b"\xFF\xD8\xFF", offset=0, description="JPEG")
        assert a == b

    def test_hashable(self):
        """Signatures should be usable as dict keys / set members."""
        sig = Signature(b"\xFF\xD8\xFF")
        s = {sig}
        assert sig in s


# ---------------------------------------------------------------------------
# SignatureCandidate
# ---------------------------------------------------------------------------

class TestSignatureCandidate:
    def test_creation(self):
        cand = SignatureCandidate(
            offset=4096,
            format_name="jpeg",
            signature_hex="ff d8 ff",
        )
        assert cand.offset == 4096
        assert cand.format_name == "jpeg"
        assert cand.signature_hex == "ff d8 ff"


# ---------------------------------------------------------------------------
# ValidationResult
# ---------------------------------------------------------------------------

class TestValidationResult:
    def test_default_values(self):
        result = ValidationResult()
        assert result.valid is False
        assert result.format_name == ""
        assert result.confidence_score == 0.0
        assert result.confidence_factors == {}

    def test_to_dict(self):
        result = ValidationResult(
            valid=True,
            format_name="jpeg",
            offset=4096,
            estimated_size=50000,
            confidence_score=0.85123,
            confidence_factors={"valid_header": 0.25111},
            details="Valid JPEG structure",
        )
        d = result.to_dict()
        assert d["valid"] is True
        assert d["type"] == "jpeg"
        assert d["offset"] == 4096
        assert d["confidence_score"] == 0.8512  # Rounded to 4 places
        assert d["confidence_factors"]["valid_header"] == 0.2511

    def test_to_dict_error(self):
        result = ValidationResult(
            valid=False,
            format_name="bmp",
            error="Reserved bytes are non-zero",
        )
        d = result.to_dict()
        assert d["valid"] is False
        assert d["error"] == "Reserved bytes are non-zero"


# ---------------------------------------------------------------------------
# RecoveredArtifact
# ---------------------------------------------------------------------------

class TestRecoveredArtifact:
    def test_auto_uuid(self):
        a = RecoveredArtifact()
        b = RecoveredArtifact()
        assert a.artifact_id != b.artifact_id
        assert len(a.artifact_id) == 36  # UUID4 format

    def test_to_dict(self):
        artifact = RecoveredArtifact(
            format_name="jpeg",
            category=FileCategory.IMAGE,
            mime_type="image/jpeg",
            offset=4096,
            size=50000,
            sha256="abc123",
            confidence_score=0.92,
        )
        d = artifact.to_dict()
        assert d["format"] == "jpeg"
        assert d["category"] == "image"
        assert d["mime_type"] == "image/jpeg"
        assert d["sha256"] == "abc123"
        assert d["is_complete"] is True
        assert d["is_fragmented"] is False

    def test_default_category(self):
        artifact = RecoveredArtifact()
        assert artifact.category == FileCategory.OTHER
