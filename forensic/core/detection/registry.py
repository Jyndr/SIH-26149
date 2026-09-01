"""
FormatDefinition and FormatRegistry — data-driven format knowledge.

Adding a new format = adding an entry to formats/signatures.json.
The scanner, validator, carver, and reporter all consult the registry.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from core.types import FileCategory, Signature


@dataclass(frozen=True)
class FormatDefinition:
    """Complete description of a file format."""
    name: str
    description: str
    category: FileCategory
    extensions: tuple[str, ...] = ()
    mime_type: str = "application/octet-stream"
    signatures: tuple[Signature, ...] = ()
    footer: bytes | None = None
    min_size: int = 0
    max_size: int | None = None
    validator_key: str | None = None
    carving_strategy: str = "contiguous"
    confidence_factors: dict[str, float] = field(default_factory=dict)
    riff_subtype: str | None = None   # For RIFF-based: "WAVE", "AVI ", "WEBP"


class FormatRegistry:
    """Thread-safe registry of all known format definitions."""

    def __init__(self) -> None:
        self._formats: dict[str, FormatDefinition] = {}

    def register(self, defn: FormatDefinition) -> None:
        if defn.name in self._formats:
            raise ValueError(f"Format already registered: {defn.name!r}")
        self._formats[defn.name] = defn

    def get(self, name: str) -> FormatDefinition:
        try:
            return self._formats[name]
        except KeyError:
            raise KeyError(f"Unknown format: {name!r}. Registered: {sorted(self._formats)}") from None

    def get_all(self) -> list[FormatDefinition]:
        return sorted(self._formats.values(), key=lambda d: d.name)

    def get_by_category(self, category: FileCategory) -> list[FormatDefinition]:
        return sorted((d for d in self._formats.values() if d.category == category), key=lambda d: d.name)

    def get_by_mime(self, mime_type: str) -> FormatDefinition | None:
        """Return the first definition matching *mime_type*."""
        return next((d for d in self._formats.values() if d.mime_type == mime_type), None)

    def get_all_signatures(self) -> list[tuple[str, Signature]]:
        """All (format_name, Signature) pairs for the scanner."""
        pairs = []
        for d in self._formats.values():
            for sig in d.signatures:
                pairs.append((d.name, sig))
        return pairs

    def get_riff_formats(self) -> dict[str, FormatDefinition]:
        """Return {subtype: FormatDefinition} for RIFF-based formats."""
        return {d.riff_subtype: d for d in self._formats.values() if d.riff_subtype}

    def names(self) -> list[str]:
        return sorted(self._formats.keys())

    def __len__(self) -> int:
        return len(self._formats)

    def __contains__(self, name: str) -> bool:
        return name in self._formats

    def __repr__(self) -> str:
        return f"FormatRegistry({len(self)} formats)"
