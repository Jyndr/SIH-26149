"""Detection subpackage — signature registry and chunked scanner."""
from core.detection.registry import FormatDefinition, FormatRegistry
from core.detection.scanner import ChunkedScanner

__all__ = ["FormatDefinition", "FormatRegistry", "ChunkedScanner"]
