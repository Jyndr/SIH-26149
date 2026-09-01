from pathlib import Path

from core.detection.signatures import load_signatures
from core.image_reader.raw import RawImageReader
from core.pipeline import ForensicPipeline, PipelineConfig
from core.validation.validator import validate_candidate


def _mpeg1_l3_frame(fill: int = 0) -> bytes:
    # MPEG-1 Layer III, 128 kbps, 44.1 kHz, no padding: 417 bytes.
    header = bytes.fromhex("FF FB 90 00")
    return header + bytes([fill]) * (417 - len(header))


def _validate(path: Path, offset: int = 0):
    with RawImageReader(path) as reader:
        return validate_candidate(reader, offset, "mp3", load_signatures())


def test_rejects_isolated_sync_word(tmp_path):
    source = tmp_path / "false-positive.img"
    source.write_bytes(bytes.fromhex("FF FB 90 00") + b"\0" * 4096)
    result = _validate(source)
    assert not result.valid
    assert result.estimated_size == 0
    assert "consecutive" in result.error


def test_rejects_reserved_layer_header(tmp_path):
    source = tmp_path / "reserved-layer.img"
    source.write_bytes(bytes.fromhex("FF F9 90 00") + b"\0" * 4096)
    result = _validate(source)
    assert not result.valid
    assert "valid MPEG Layer III" in result.error


def test_walks_consecutive_frames_to_exact_boundary(tmp_path):
    stream = b"".join(_mpeg1_l3_frame(i) for i in range(4))
    source = tmp_path / "valid.mp3"
    source.write_bytes(stream + b"unrelated trailing bytes")
    result = _validate(source)
    assert result.valid
    assert result.estimated_size == len(stream)
    assert result.confidence_score == 0.85
    assert "4 consecutive frames" in result.details


def test_pipeline_recovers_frame_stream_only_once(tmp_path):
    stream = b"".join(_mpeg1_l3_frame(i) for i in range(5))
    evidence = tmp_path / "evidence.img"
    evidence.write_bytes(b"prefix" + stream + b"suffix")
    report = ForensicPipeline(PipelineConfig(chunk_size=128)).run(
        evidence, tmp_path / "output", "MP3-REGRESSION")
    mp3_artifacts = [artifact for artifact in report.artifacts
                     if artifact.format_name == "mp3"]
    assert len(mp3_artifacts) == 1
    recovered = Path(mp3_artifacts[0].output_path)
    assert recovered.read_bytes() == stream
    assert recovered.stat().st_size < 100 * 1024 * 1024
