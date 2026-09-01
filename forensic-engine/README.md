# Forensic Engine

A bounded-memory, read-only evidence analysis and contiguous file-carving engine.

## Quick start

```bash
cd forensic-engine
python -m pip install -e .
forensic-engine analyze evidence.img --case-id CASE-001 --output ./recovered
```

E01 images require the optional binding:

```bash
python -m pip install -e '.[ewf]'
```

Other useful commands:

```bash
forensic-engine verify evidence.E01
forensic-engine formats
```

The analyzer writes recovered artifacts under
`<output>/<case-id>/` and produces `report.json`. The source image is opened only
for reading. The output directory must be different from the evidence directory.

## Pipeline

`EvidenceManager` records the source type, logical size, SHA-256, timestamps, and
status. `ImageReader` normalizes RAW and EWF access. The pipeline then detects
MBR/GPT partitions and filesystem types, scans chunks with cross-boundary overlap,
validates candidates using format plugins, carves validated contiguous artifacts,
classifies and hashes them, and emits a JSON report.

Format metadata lives in `formats/signatures.json`; validator and filesystem
parsers use registries. Adding a format does not require changing the scanner.

## Scope and forensic limitations

- RAW and split EWF/E01 logical-byte access are supported; EWF depends on `pyewf`.
- MBR/GPT and NTFS/FAT32/exFAT/ext identification are implemented. Filesystem
  metadata enumeration is exposed as a plugin interface; no filesystem parser is
  bundled yet, so existing/deleted filename recovery is not claimed.
- The current carvers recover contiguous artifacts whose validators establish a
  boundary. Fragment reconstruction has an explicit result model but remains
  unsupported and is never represented as successful recovery.
- Ten strong validators are included: JPEG, PNG, GIF, BMP, PDF, ZIP/OOXML, RIFF
  (WAV/AVI/WebP), MP3, FLV, and MPEG program streams. Other registered signatures
  are detection definitions until a validator plugin is added.
- Signature hits are reported internally as candidates, never as recovered files.

Run the test suite with `pytest`.
