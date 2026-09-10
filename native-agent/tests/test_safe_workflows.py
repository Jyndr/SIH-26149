import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace

from native_agent.acquisition.service import AcquisitionService
from native_agent.devices.base import DeviceRecord
from native_agent.sanitization.service import SanitizationService


class FakeRegistry:
    def __init__(self, source):
        self.device = DeviceRecord(
            id="dev_1234567890abcdef12345678", name="Disposable test image", device_path=str(source),
            size=source.stat().st_size, bus="USB", removable=True, read_only=True,
        )

    def get(self, device_id):
        if device_id != self.device.id:
            raise KeyError("Unknown device")
        return self.device

    @staticmethod
    def to_public(device):
        return {"id": device.id, "name": device.name, "size": device.size, "removable": device.removable}


class MemoryAudit:
    def __init__(self):
        self.entries = []

    def record(self, operation, case_id, target, details):
        self.entries.append({"operation": operation, "caseId": case_id, "target": target, **details})


class SafeWorkflowTests(unittest.TestCase):
    def test_acquisition_copies_and_hashes_disposable_image(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.bin"
            source.write_bytes(b"CYPR" * 4096)
            output = root / "images"
            output.mkdir()
            audit = MemoryAudit()
            service = AcquisitionService(FakeRegistry(source), output, audit)
            request = SimpleNamespace(deviceId="dev_1234567890abcdef12345678", caseId="CASE-TEST", imageFormat="RAW")

            started = service.start(request)
            for _ in range(100):
                job = service.get(started["jobId"])
                if job["status"] != "RUNNING" and job["status"] != "QUEUED":
                    break
                time.sleep(0.01)

            self.assertEqual(job["status"], "COMPLETED")
            self.assertEqual(Path(job["imagePath"]).read_bytes(), source.read_bytes())
            self.assertEqual(len(job["sha256"]), 64)
            self.assertEqual(audit.entries[-1]["mode"], "READ_ONLY")

    def test_sanitization_is_never_executed(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.bin"
            source.write_bytes(b"must remain unchanged")
            before = source.read_bytes()
            audit = MemoryAudit()
            service = SanitizationService(FakeRegistry(source), audit)
            request = SimpleNamespace(
                deviceId="dev_1234567890abcdef12345678", caseId="CASE-TEST", method="PURGE",
                targetScope="DEVICE", artifactId=None,
            )

            result = service.start(request)

            self.assertEqual(result["status"], "DRY_RUN")
            self.assertFalse(result["executed"])
            self.assertEqual(result["verificationStatus"], "NOT_EXECUTED")
            self.assertEqual(source.read_bytes(), before)

    def test_file_scope_requires_evidence_reference_and_counters_both_recovery_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.bin"
            source.write_bytes(b"evidence")
            service = SanitizationService(FakeRegistry(source), MemoryAudit())
            missing_reference = SimpleNamespace(
                deviceId="dev_1234567890abcdef12345678", caseId="CASE-TEST", method="CLEAR",
                targetScope="FILE", artifactId=None,
            )
            with self.assertRaises(ValueError):
                service.prepare(missing_reference)

            request = SimpleNamespace(
                deviceId="dev_1234567890abcdef12345678", caseId="CASE-TEST", method="CLEAR",
                targetScope="FILE", artifactId="artifact-42",
            )
            plan = service.prepare(request)
            self.assertEqual(plan["targetScope"], "FILE")
            self.assertFalse(plan["supported"])
            self.assertIn("filesystem-metadata-recovery", plan["counteredRecoveryPaths"])
            self.assertIn("whole-image-signature-carving", plan["counteredRecoveryPaths"])
            self.assertIn("scan-unallocated-space-for-content-signatures", plan["requirements"])


if __name__ == "__main__":
    unittest.main()
