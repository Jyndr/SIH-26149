"""
Core forensic engine package.

Subpackages:
  image_reader   — Evidence image abstraction (RAW, E01)
  filesystem     — FAT/exFAT/NTFS/ext metadata parsing and recovery
  detection      — Signature registry + chunked scanner
  validation     — Structural validators per format
  carving        — File extraction strategies
  classification — Content-based file classification
  integrity      — Hashing and evidence management
  reporting      — Forensic report generation
"""
