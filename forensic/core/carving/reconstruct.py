"""
Fragment reconstruction — architecture stub for future implementation.

Fragmented file recovery is fundamentally different from contiguous carving.
This module defines the interfaces that will eventually support:
  - Fragment candidate discovery
  - Block/cluster relationship mapping
  - Structure-aware reconstruction
  - Fragment scoring and validation

Currently: placeholder for architecture completeness.
"""
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class Fragment:
    """A candidate fragment of a file."""
    offset: int = 0
    size: int = 0
    sequence_number: int = 0
    confidence: float = 0.0


@dataclass
class ReconstructionResult:
    """Result of attempting to reconstruct a fragmented file."""
    success: bool = False
    fragments: list[Fragment] = field(default_factory=list)
    total_size: int = 0
    reconstruction_method: str = ""
    confidence: float = 0.0
    validation_passed: bool = False
    error: str = ""


class FragmentReconstructor:
    """Future: reconstruct files from non-contiguous fragments.

    Not yet implemented.  The architecture is in place so that
    format-specific reconstructors can be added without changing
    the pipeline.
    """

    def reconstruct(self, fragments: list[Fragment]) -> ReconstructionResult:
        return ReconstructionResult(
            success=False,
            error="Fragment reconstruction not yet implemented",
        )
