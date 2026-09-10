from abc import ABC, abstractmethod
from datetime import datetime, timezone
from enum import Enum
import hashlib
import os
from uuid import uuid4


class SanitizationMethod(str, Enum):
    CLEAR = "CLEAR"
    PURGE = "PURGE"
    CRYPTOGRAPHIC_ERASE = "CRYPTOGRAPHIC_ERASE"
    DESTROY = "DESTROY"


class SanitizationProvider(ABC):
    @abstractmethod
    def inspect(self, device, target=None) -> dict:
        raise NotImplementedError

    @abstractmethod
    def sanitize(self, device, case_id: str, method: SanitizationMethod | None = None, target=None) -> dict:
        raise NotImplementedError


class MockSanitizationProvider(SanitizationProvider):
    reason = "Real sanitization provider not enabled."

    def inspect(self, device, target=None) -> dict:
        from .planner import SanitizationPlanner, SanitizationTarget, TargetScope
        resolved = target or SanitizationTarget(device.id, TargetScope.DEVICE)
        return {"deviceId": device.id, **SanitizationPlanner().plan(device, resolved)}

    def sanitize(self, device, case_id: str, method: SanitizationMethod | None = None, target=None) -> dict:
        plan = self.inspect(device, target)
        now = datetime.now(timezone.utc).isoformat()
        return {"jobId": f"SAN-{uuid4().hex}", "caseId": case_id, "target": device.id,
                "operation": "SANITIZATION", "method": (method or SanitizationMethod.CLEAR).value,
                "mode": "DRY_RUN", "startedAt": now, "completedAt": now, "executed": False,
                "verificationStatus": "NOT_EXECUTED", "status": "DRY_RUN", "supported": False,
                "targetScope": plan["targetScope"], "artifactId": plan["artifactId"],
                "requirements": plan["requirements"], "counteredRecoveryPaths": plan["counteredRecoveryPaths"],
                "reason": plan["reason"]}


class OverwriteSanitizationProvider(SanitizationProvider):
    chunk_size = 1024 * 1024

    def __init__(self, enabled: bool = False):
        self.enabled = enabled

    def inspect(self, device, target=None) -> dict:
        from .planner import SanitizationPlanner, SanitizationTarget, TargetScope
        resolved = target or SanitizationTarget(device.id, TargetScope.DEVICE)
        plan = SanitizationPlanner().plan(device, resolved)
        blockers = self._blockers(device, resolved)
        supported = self.enabled and not blockers
        return {
            **plan,
            "supported": supported,
            "availableMethods": ["CLEAR"] if supported else [],
            "mode": "LIVE" if supported else "DRY_RUN",
            "reason": "Ready for single-pass overwrite." if supported else "; ".join(blockers) or plan["reason"],
        }

    def sanitize(self, device, case_id: str, method: SanitizationMethod | None = None, target=None, confirmation: str | None = None) -> dict:
        plan = self.inspect(device, target)
        if not plan["supported"]:
            return MockSanitizationProvider().sanitize(device, case_id, method, target)

        selected_method = method or SanitizationMethod.CLEAR
        if selected_method is not SanitizationMethod.CLEAR:
            raise ValueError("Only CLEAR overwrite is implemented for live removable-device sanitization")
        expected = f"ERASE {device.name}"
        if confirmation != expected:
            raise ValueError(f'Type "{expected}" to confirm live erasure')

        started = datetime.now(timezone.utc).isoformat()
        bytes_written, digest = self._overwrite_with_zeroes(device.device_path, device.size)
        completed = datetime.now(timezone.utc).isoformat()
        return {
            "jobId": f"SAN-{uuid4().hex}",
            "caseId": case_id,
            "target": device.id,
            "operation": "SANITIZATION",
            "method": selected_method.value,
            "mode": "LIVE",
            "startedAt": started,
            "completedAt": completed,
            "executed": True,
            "bytesWritten": bytes_written,
            "verificationStatus": "VERIFIED",
            "status": "COMPLETED",
            "supported": True,
            "targetScope": plan["targetScope"],
            "artifactId": plan["artifactId"],
            "requirements": plan["requirements"],
            "counteredRecoveryPaths": plan["counteredRecoveryPaths"],
            "reason": "Device overwritten with zeroes and read-back spot verified.",
            "verification": {"pattern": "zero-fill", "sampleSha256": digest},
        }

    def _blockers(self, device, target) -> list[str]:
        blockers = []
        if not self.enabled:
            blockers.append("Set CYPHORA_ENABLE_DESTRUCTIVE_ERASURE=true to enable live erasure")
        if target.scope.value != "DEVICE":
            blockers.append("Live file-level secure erase is not implemented")
        if not device.removable:
            blockers.append("Only removable devices are accepted for live erasure")
        if device.mount_point:
            blockers.append(f"Unmount the device first ({device.mount_point})")
        if device.read_only:
            blockers.append("Device is read-only")
        if not str(device.device_path).startswith("/dev/"):
            blockers.append("Live erasure only accepts block devices under /dev")
        return blockers

    def _overwrite_with_zeroes(self, path: str, size: int) -> tuple[int, str]:
        fd = os.open(path, os.O_RDWR | os.O_SYNC)
        try:
            zeroes = b"\0" * self.chunk_size
            written = 0
            while written < size:
                block = zeroes[:min(self.chunk_size, size - written)]
                written += os.write(fd, block)
            os.fsync(fd)
            os.lseek(fd, 0, os.SEEK_SET)
            sample = os.read(fd, min(self.chunk_size, size))
            if sample != b"\0" * len(sample):
                raise RuntimeError("Read-back verification failed: non-zero data remains at start of device")
            return written, hashlib.sha256(sample).hexdigest()
        finally:
            os.close(fd)
