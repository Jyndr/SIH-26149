"""
Validator dispatch — routes candidates to format-specific validators.

Scanner says: "I found bytes matching a signature."
Validator says: "The structure actually looks like this format."
These are SEPARATE stages.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from core.types import ValidationResult
from core.image_reader.base import ImageReader
from core.detection.registry import FormatRegistry

# Global validator registry: validator_key → FormatValidator instance
_VALIDATORS: dict[str, "FormatValidator"] = {}


class FormatValidator(ABC):
    """Base class for format-specific structural validators."""

    @abstractmethod
    def validate(self, reader: ImageReader, offset: int, format_name: str) -> ValidationResult:
        """Check if bytes at *offset* form a valid file of this format.

        Must read from *reader* (never modify evidence) and return a
        ValidationResult with confidence_factors explaining the score.
        """

    @staticmethod
    def register(key: str, validator: "FormatValidator") -> None:
        _VALIDATORS[key] = validator

    @staticmethod
    def get(key: str) -> "FormatValidator | None":
        return _VALIDATORS.get(key)


def _ensure_validators_loaded():
    """Import all validator modules to trigger registration."""
    if _VALIDATORS:
        return
    # Each module registers itself on import
    import core.validation.validators  # noqa: F401


def validate_candidate(
    reader: ImageReader,
    offset: int,
    format_name: str,
    registry: FormatRegistry,
) -> ValidationResult:
    """Validate a single candidate using the appropriate validator.

    Returns a ValidationResult.  If no validator exists for the format,
    returns a result with valid=False and an explanatory error.
    """
    _ensure_validators_loaded()

    fmt_def = registry.get(format_name)
    validator_key = fmt_def.validator_key

    if validator_key is None:
        return ValidationResult(
            valid=False, format_name=format_name, offset=offset,
            error=f"No validator implemented for {format_name}",
        )

    validator = FormatValidator.get(validator_key)
    if validator is None:
        return ValidationResult(
            valid=False, format_name=format_name, offset=offset,
            error=f"Validator key {validator_key!r} not found",
        )

    try:
        return validator.validate(reader, offset, format_name)
    except Exception as exc:
        return ValidationResult(
            valid=False, format_name=format_name, offset=offset,
            error=f"Validation error: {exc}",
        )
