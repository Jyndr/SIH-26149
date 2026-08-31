"""
Load format definitions from formats/signatures.json into a FormatRegistry.

Hex strings in JSON → bytes.  All format knowledge is data-driven.
"""
from __future__ import annotations
import json
from pathlib import Path
from core.types import FileCategory, Signature
from core.detection.registry import FormatDefinition, FormatRegistry

# Default path to signatures JSON (relative to project root)
_DEFAULT_SIGNATURES_PATH = Path(__file__).resolve().parent.parent.parent / "formats" / "signatures.json"


def _hex_to_bytes(hex_str: str | None) -> bytes | None:
    """Convert hex string like 'FFD8FF' to bytes, or None."""
    if hex_str is None:
        return None
    return bytes.fromhex(hex_str)


def load_signatures(path: str | Path | None = None) -> FormatRegistry:
    """Load all format definitions from JSON and return a populated registry.

    Parameters
    ----------
    path : str or Path, optional
        Path to signatures.json.  Defaults to formats/signatures.json.
    """
    if path is None:
        path = _DEFAULT_SIGNATURES_PATH
    path = Path(path)

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    registry = FormatRegistry()

    for fmt in data["formats"]:
        sigs = tuple(
            Signature(
                pattern=bytes.fromhex(s["pattern"]),
                offset=s.get("offset", 0),
                description=s.get("description", ""),
            )
            for s in fmt.get("signatures", [])
        )

        defn = FormatDefinition(
            name=fmt["name"],
            description=fmt["description"],
            category=FileCategory(fmt["category"]),
            extensions=tuple(fmt.get("extensions", [])),
            mime_type=fmt.get("mime_type", "application/octet-stream"),
            signatures=sigs,
            footer=_hex_to_bytes(fmt.get("footer")),
            min_size=fmt.get("min_size", 0),
            max_size=fmt.get("max_size"),
            validator_key=fmt.get("validator"),
            carving_strategy=fmt.get("carving_strategy", "contiguous"),
            confidence_factors=fmt.get("confidence_factors", {}),
            riff_subtype=fmt.get("riff_subtype"),
        )
        registry.register(defn)

    return registry
