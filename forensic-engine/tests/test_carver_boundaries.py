from core.carving.carver import Carver
from core.image_reader.raw import RawImageReader
from core.types import ValidationResult


def _carve(tmp_path, estimated_size, max_carve_size=1024):
    evidence = tmp_path / "evidence.img"
    evidence.write_bytes(b"x" * 4096)
    output = tmp_path / "output"
    candidate = ValidationResult(
        valid=True, format_name="jpeg", offset=0,
        estimated_size=estimated_size, confidence_score=0.9,
    )
    from core.detection.signatures import load_signatures
    with RawImageReader(evidence) as reader:
        result = Carver(max_carve_size=max_carve_size).carve(
            reader, candidate, output, "BOUNDARY", load_signatures())
    return result, output


def test_unknown_boundary_is_not_carved_to_max_size(tmp_path):
    result, output = _carve(tmp_path, estimated_size=0)
    assert not result.success
    assert "did not establish" in result.error
    assert not output.exists()


def test_boundary_over_limit_is_not_partially_recovered(tmp_path):
    result, output = _carve(tmp_path, estimated_size=2048, max_carve_size=1024)
    assert not result.success
    assert "exceeds configured carve limit" in result.error
    assert not output.exists()


def test_known_boundary_is_carved_exactly(tmp_path):
    result, output = _carve(tmp_path, estimated_size=512)
    assert result.success
    assert result.is_complete
    assert result.size == 512
    assert output.exists()
