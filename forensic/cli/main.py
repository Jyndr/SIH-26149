"""Command line interface for forensic-engine."""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path
from core.detection.signatures import load_signatures
from core.integrity.evidence import EvidenceManager
from core.pipeline import ForensicPipeline, PipelineConfig


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be positive")
    return parsed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="forensic-engine",
                                     description="Read-only forensic image analysis")
    sub = parser.add_subparsers(dest="command", required=True)
    analyze = sub.add_parser("analyze", help="analyze and carve an image")
    analyze.add_argument("evidence", type=Path)
    analyze.add_argument("--output", type=Path, required=True)
    analyze.add_argument("--case-id", required=True)
    analyze.add_argument("--report", type=Path)
    analyze.add_argument("--chunk-size", type=positive_int, default=4 * 1024 * 1024)
    analyze.add_argument("--max-carve-size", type=positive_int, default=100 * 1024 * 1024)
    analyze.add_argument("--signatures", type=Path)
    verify = sub.add_parser("verify", help="hash an evidence image")
    verify.add_argument("evidence", type=Path)
    formats = sub.add_parser("formats", help="list registered formats")
    formats.add_argument("--signatures", type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "formats":
            for definition in load_signatures(args.signatures).get_all():
                print(f"{definition.name:8} {definition.mime_type:65} {definition.description}")
            return 0
        if args.command == "verify":
            record = EvidenceManager().register(args.evidence, "verification")
            print(json.dumps(record.to_dict(), indent=2))
            return 0
        config = PipelineConfig(args.chunk_size, args.max_carve_size,
                                str(args.signatures) if args.signatures else None)
        report = ForensicPipeline(config).run(args.evidence, args.output, args.case_id)
        report_path = args.report or args.output / args.case_id / "report.json"
        report.write_json(report_path)
        print(f"Recovered {len(report.artifacts)} artifact(s); report: {report_path}")
        return 0
    except (OSError, RuntimeError, ValueError, KeyError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
