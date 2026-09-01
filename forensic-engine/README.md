# Forensic Engine

A bounded-memory, read-only filesystem recovery and file-carving engine.

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
MBR/GPT partitions and filesystem types. FAT12/16/32, exFAT, NTFS, and ext2/3/4
metadata parsers enumerate files and allocation extents; the recovery stage
reconstructs recoverable active and deleted files while retaining original paths,
timestamps, attributes, and record identifiers. The existing signature scan,
structural validation, and contiguous-carving stages still run afterward as a
fallback for content that has no usable filesystem metadata. Every output is
hashed and included in the same JSON report.

Format metadata lives in `formats/signatures.json`; validators and filesystem
parsers use registries. Adding a format does not require changing the scanner.

Filesystem recovery is enabled by default. Useful controls are:

```bash
forensic-engine analyze evidence.img --case-id CASE-001 --output ./recovered \
  --allocated-only
forensic-engine analyze evidence.img --case-id CASE-001 --output ./recovered \
  --max-filesystem-file-size 1073741824
forensic-engine analyze evidence.img --case-id CASE-001 --output ./recovered \
  --no-filesystem-recovery
```

## Scope and forensic limitations

- RAW and split EWF/E01 logical-byte access are supported; EWF depends on `pyewf`.
- MBR/GPT discovery and FAT12/16/32, exFAT, NTFS, and ext2/3/4 metadata recovery
  are implemented. Fragmented and sparse files are reconstructed when their
  allocation metadata is intact. Resident NTFS data is also supported.
- Deleted-file metadata can point to clusters or blocks that were subsequently
  reused. Such results receive lower confidence, and incomplete allocation maps
  are reported as partial rather than silently represented as intact files.
- Filesystem-specific compression, encryption, damaged metadata trees, and
  overwritten allocation records can prevent complete recovery. Signature
  carving remains available for those cases, but cannot restore original names.
- Signature carvers recover contiguous artifacts whose validators establish a
  boundary; carving without an allocation map cannot reconstruct fragments.
  Filesystem recovery can reconstruct fragmentation when metadata supplies the
  logical-to-physical extent map.
- Ten strong validators are included: JPEG, PNG, GIF, BMP, PDF, ZIP/OOXML, RIFF
  (WAV/AVI/WebP), MP3, FLV, and MPEG program streams. Other registered signatures
  are detection definitions until a validator plugin is added.
- Signature hits are reported internally as candidates, never as recovered files.

Run the test suite with `pytest`.
