import json
from pathlib import Path

from cli.main import main
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
