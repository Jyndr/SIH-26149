import json
from pathlib import Path

from cli.main import main
from core.filesystem import FileSystemAnalyzer
from core.integrity.evidence import EvidenceManager
from core.pipeline import ForensicPipeline, PipelineConfig
from conftest import create_tiny_png


def test_end_to_end_png(tmp_path):
    png = create_tiny_png(tmp_path / "source.png").read_bytes()
    evidence = tmp_path / "evidence.img"
    evidence.write_bytes(b"unused-prefix" + png + b"unused-tail")
    output = tmp_path / "recovery"

    report = ForensicPipeline(PipelineConfig(chunk_size=7)).run(
        evidence, output, "CASE-001")

    assert report.evidence.status.value == "complete"
    assert report.statistics["recovered_artifacts"] == 1
    artifact = report.artifacts[0]
    assert artifact.format_name == "png"
    assert Path(artifact.output_path).read_bytes() == png
    report_path = report.write_json(output / "CASE-001" / "report.json")
    assert json.loads(report_path.read_text())["artifacts"][0]["sha256"]


def test_evidence_verification_detects_change(tmp_path):
    source = tmp_path / "evidence.img"
    source.write_bytes(b"original")
    manager = EvidenceManager()
    record = manager.register(source, "case")
    assert manager.verify(record)
    source.write_bytes(b"modified")
    assert not manager.verify(record)


def test_cli_analyze(tmp_path):
    evidence = tmp_path / "blank.img"
    evidence.write_bytes(b"\0" * 1024)
    output = tmp_path / "out"
    assert main(["analyze", str(evidence), "--output", str(output),
                 "--case-id", "CASE-CLI", "--chunk-size", "64"]) == 0
    assert (output / "CASE-CLI" / "report.json").exists()


def test_pipeline_prefers_complete_filesystem_recovery_to_duplicate_carving(tmp_path):
    png = create_tiny_png(tmp_path / "source.png").read_bytes()
    evidence = tmp_path / "filesystem.img"
    data_offset = 512
    evidence.write_bytes(b"\0" * data_offset + png + b"\0" * 64)

    def metadata_parser(reader, partition):
        return [{
            "name": "original.png",
            "path": "/Pictures/original.png",
            "size": len(png),
            "allocated": True,
            "is_complete": True,
            "extents": [{
                "logical_offset": 0,
                "image_offset": data_offset,
                "length": len(png),
            }],
        }]

    previous = FileSystemAnalyzer._plugins.get("unknown")
    FileSystemAnalyzer.register("unknown", metadata_parser)
    try:
        report = ForensicPipeline(PipelineConfig(chunk_size=31)).run(
            evidence, tmp_path / "out", "CASE-METADATA")
    finally:
        if previous is None:
            FileSystemAnalyzer._plugins.pop("unknown", None)
        else:
            FileSystemAnalyzer._plugins["unknown"] = previous

    assert len(report.artifacts) == 1
    artifact = report.artifacts[0]
    assert artifact.recovery_method == "filesystem"
    assert artifact.metadata["original_path"] == "/Pictures/original.png"
    assert Path(artifact.output_path).read_bytes() == png
    assert report.statistics["existing_files_found"] == 1
    assert report.statistics["recovered_deleted_files"] == 0
    assert report.statistics["carving_candidates_suppressed"] >= 1


def test_corrupt_filesystem_metadata_does_not_disable_carving(tmp_path):
    png = create_tiny_png(tmp_path / "fallback.png").read_bytes()
    evidence = tmp_path / "corrupt-filesystem.img"
    evidence.write_bytes(b"prefix" + png + b"tail")

    def broken_parser(reader, partition):
        raise ValueError("damaged directory tree")

    previous = FileSystemAnalyzer._plugins.get("unknown")
    FileSystemAnalyzer.register("unknown", broken_parser)
    try:
        report = ForensicPipeline(PipelineConfig(chunk_size=17)).run(
            evidence, tmp_path / "fallback-out", "CASE-FALLBACK")
    finally:
        if previous is None:
            FileSystemAnalyzer._plugins.pop("unknown", None)
        else:
            FileSystemAnalyzer._plugins["unknown"] = previous

    assert len(report.artifacts) == 1
    assert report.artifacts[0].recovery_method == "carving"
    assert Path(report.artifacts[0].output_path).read_bytes() == png
    assert any("metadata parser failed" in warning for warning in report.warnings)
