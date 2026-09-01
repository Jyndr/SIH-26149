"""
Tests for core.detection.registry — FormatDefinition and FormatRegistry.
"""

import pytest

from core.detection.registry import FormatDefinition, FormatRegistry
from core.types import FileCategory, Signature


# ---------------------------------------------------------------------------
# FormatDefinition
# ---------------------------------------------------------------------------

class TestFormatDefinition:
    def test_creation(self):
        defn = FormatDefinition(
            name="jpeg",
            description="JPEG Image",
            category=FileCategory.IMAGE,
            extensions=(".jpg", ".jpeg"),
            mime_type="image/jpeg",
            signatures=(
                Signature(b"\xFF\xD8\xFF", description="JPEG SOI"),
            ),
            footer=b"\xFF\xD9",
            min_size=107,
        )
        assert defn.name == "jpeg"
        assert defn.category == FileCategory.IMAGE
        assert defn.footer == b"\xFF\xD9"
        assert defn.min_size == 107

    def test_frozen(self):
        defn = FormatDefinition(
            name="test",
            description="Test",
            category=FileCategory.OTHER,
        )
        with pytest.raises(AttributeError):
            defn.name = "changed"

    def test_defaults(self):
        defn = FormatDefinition(
            name="test",
            description="Test format",
            category=FileCategory.OTHER,
        )
        assert defn.extensions == ()
        assert defn.signatures == ()
        assert defn.footer is None
        assert defn.min_size == 0
        assert defn.max_size is None
        assert defn.validator_key is None
        assert defn.carving_strategy == "contiguous"


# ---------------------------------------------------------------------------
# FormatRegistry — basic operations
# ---------------------------------------------------------------------------

class TestFormatRegistry:
    def _make_definition(self, name="test", category=FileCategory.OTHER, **kwargs):
        return FormatDefinition(
            name=name,
            description=f"Test format: {name}",
            category=category,
            **kwargs,
        )

    def test_register_and_get(self):
        reg = FormatRegistry()
        defn = self._make_definition("jpeg", FileCategory.IMAGE)
        reg.register(defn)
        assert reg.get("jpeg") is defn

    def test_get_unknown_raises(self):
        reg = FormatRegistry()
        with pytest.raises(KeyError, match="Unknown format"):
            reg.get("nonexistent")

    def test_duplicate_name_raises(self):
        reg = FormatRegistry()
        reg.register(self._make_definition("jpeg"))
        with pytest.raises(ValueError, match="already registered"):
            reg.register(self._make_definition("jpeg"))

    def test_get_all(self):
        reg = FormatRegistry()
        reg.register(self._make_definition("png"))
        reg.register(self._make_definition("jpeg"))
        reg.register(self._make_definition("bmp"))
        all_formats = reg.get_all()
        assert [d.name for d in all_formats] == ["bmp", "jpeg", "png"]

    def test_get_by_category(self):
        reg = FormatRegistry()
        reg.register(self._make_definition("jpeg", FileCategory.IMAGE))
        reg.register(self._make_definition("pdf", FileCategory.DOCUMENT))
        reg.register(self._make_definition("png", FileCategory.IMAGE))

        images = reg.get_by_category(FileCategory.IMAGE)
        assert [d.name for d in images] == ["jpeg", "png"]

        docs = reg.get_by_category(FileCategory.DOCUMENT)
        assert [d.name for d in docs] == ["pdf"]

    def test_get_by_category_empty(self):
        reg = FormatRegistry()
        reg.register(self._make_definition("jpeg", FileCategory.IMAGE))
        assert reg.get_by_category(FileCategory.DATABASE) == []

    def test_get_by_mime(self):
        reg = FormatRegistry()
        reg.register(self._make_definition(
            "jpeg", FileCategory.IMAGE, mime_type="image/jpeg",
        ))
        result = reg.get_by_mime("image/jpeg")
        assert result is not None
        assert result.name == "jpeg"

    def test_get_by_mime_not_found(self):
        reg = FormatRegistry()
        assert reg.get_by_mime("nonexistent/type") is None

    def test_get_all_signatures(self):
        reg = FormatRegistry()
        sig1 = Signature(b"\xFF\xD8\xFF", description="JPEG")
        sig2 = Signature(b"\x89PNG\r\n\x1a\n", description="PNG")
        reg.register(self._make_definition(
            "jpeg", signatures=(sig1,),
        ))
        reg.register(self._make_definition(
            "png", signatures=(sig2,),
        ))

        pairs = reg.get_all_signatures()
        assert len(pairs) == 2
        names = {name for name, sig in pairs}
        assert "jpeg" in names
        assert "png" in names

    def test_names(self):
        reg = FormatRegistry()
        reg.register(self._make_definition("bmp"))
        reg.register(self._make_definition("jpeg"))
        assert reg.names() == ["bmp", "jpeg"]

    def test_len(self):
        reg = FormatRegistry()
        assert len(reg) == 0
        reg.register(self._make_definition("jpeg"))
        assert len(reg) == 1

    def test_contains(self):
        reg = FormatRegistry()
        reg.register(self._make_definition("jpeg"))
        assert "jpeg" in reg
        assert "png" not in reg

    def test_repr(self):
        reg = FormatRegistry()
        reg.register(self._make_definition("jpeg"))
        assert "1 formats" in repr(reg)


# ---------------------------------------------------------------------------
# Built-in format loading
# ---------------------------------------------------------------------------

class TestBuiltinFormats:
    """Test that all built-in format definitions load correctly."""

    def test_all_formats_load(self, registry):
        """The registry fixture loads all built-in formats."""
        assert len(registry) >= 25  # At least 25 formats defined

    def test_expected_format_names(self, registry):
        """Key format names should be present."""
        expected = {
            "jpeg", "png", "gif", "bmp", "tiff", "webp",
            "pdf", "rtf",
            "zip", "rar", "7z", "gzip",
            "mp3", "wav", "flac", "ogg", "au",
            "mp4", "mov", "avi", "mpg", "flv", "mkv",
            "docx", "xlsx", "pptx",
        }
        actual = set(registry.names())
        missing = expected - actual
        assert not missing, f"Missing formats: {missing}"

    def test_every_format_has_category(self, registry):
        for defn in registry.get_all():
            assert isinstance(defn.category, FileCategory), (
                f"{defn.name} has invalid category: {defn.category}"
            )

    def test_every_format_has_description(self, registry):
        for defn in registry.get_all():
            assert defn.description, f"{defn.name} has empty description"

    def test_every_format_has_mime_type(self, registry):
        for defn in registry.get_all():
            assert "/" in defn.mime_type, (
                f"{defn.name} has invalid MIME type: {defn.mime_type}"
            )

    def test_image_formats_are_images(self, registry):
        images = registry.get_by_category(FileCategory.IMAGE)
        names = {d.name for d in images}
        assert "jpeg" in names
        assert "png" in names
        assert "gif" in names

    def test_riff_formats_use_riff_validator(self, registry):
        """WAV, AVI, and WebP should all use the 'riff' validator."""
        for name in ("wav", "avi", "webp"):
            defn = registry.get(name)
            assert defn.validator_key == "riff", (
                f"{name} should use 'riff' validator, "
                f"got {defn.validator_key!r}"
            )

    def test_office_formats_use_zip_validator(self, registry):
        """DOCX, XLSX, PPTX should use the 'zip' validator."""
        for name in ("docx", "xlsx", "pptx"):
            defn = registry.get(name)
            assert defn.validator_key == "zip", (
                f"{name} should use 'zip' validator, "
                f"got {defn.validator_key!r}"
            )

    def test_jpeg_has_footer(self, registry):
        jpeg = registry.get("jpeg")
        assert jpeg.footer == b"\xFF\xD9"

    def test_png_has_footer(self, registry):
        png = registry.get("png")
        assert png.footer == b"IEND"

    def test_gzip_uses_3_byte_signature(self, registry):
        """GZIP must use 3-byte signature (not 2) to reduce false positives."""
        gzip_def = registry.get("gzip")
        for sig in gzip_def.signatures:
            assert len(sig.pattern) >= 3, (
                "GZIP signature must be at least 3 bytes "
                "to include compression method byte"
            )

    def test_bmp_has_min_size(self, registry):
        """BMP must have a minimum size to help reject false positives."""
        bmp = registry.get("bmp")
        assert bmp.min_size >= 26  # BMP header + minimal DIB header

    def test_confidence_factors_are_reasonable(self, registry):
        """Confidence factors for each format should sum to ~1.0."""
        for defn in registry.get_all():
            if defn.confidence_factors:
                total = sum(defn.confidence_factors.values())
                assert 0.9 <= total <= 1.1, (
                    f"{defn.name} confidence factors sum to {total:.2f}, "
                    f"expected ~1.0"
                )

    def test_no_duplicate_signatures_within_format(self, registry):
        """A format should not have duplicate signatures."""
        for defn in registry.get_all():
            patterns = [sig.pattern for sig in defn.signatures]
            assert len(patterns) == len(set(patterns)), (
                f"{defn.name} has duplicate signatures"
            )
