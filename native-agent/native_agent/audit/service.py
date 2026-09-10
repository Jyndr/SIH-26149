import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from uuid import uuid4


class AuditWriter:
    def __init__(self, audit_dir: Path):
        self._path = audit_dir / "operations.jsonl"
        self._lock = RLock()

    def record(self, operation: str, case_id: str, target: str, details: dict) -> dict:
        entry = {
            "operationId": f"OP-{uuid4().hex}", "caseId": case_id, "target": target, "operation": operation,
            "timestamp": datetime.now(timezone.utc).isoformat(), **details,
        }
        entry["recordHash"] = hashlib.sha256(json.dumps(entry, sort_keys=True).encode()).hexdigest()
        with self._lock, self._path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(entry, sort_keys=True) + "\n")
        return entry

