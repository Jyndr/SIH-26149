from dataclasses import dataclass
from enum import Enum

from .providers import SanitizationMethod


class TargetScope(str, Enum):
    FILE = "FILE"
    DEVICE = "DEVICE"


@dataclass(frozen=True)
class SanitizationTarget:
    device_id: str
    scope: TargetScope
    artifact_id: str | None = None

    def validate(self) -> None:
        if not self.device_id.startswith("dev_"):
            raise ValueError("A valid opaque device identifier is required")
        if self.scope is TargetScope.FILE and not self.artifact_id:
            raise ValueError("File-scoped sanitization requires an evidence artifact or filesystem record ID")
        if self.scope is TargetScope.DEVICE and self.artifact_id:
            raise ValueError("Whole-device sanitization cannot include a file artifact ID")


class SanitizationPlanner:
    """Translate Recovery Engine capabilities into sanitization requirements."""

    def plan(self, device, target: SanitizationTarget) -> dict:
        target.validate()
        flash_media = self._is_flash(device)
        if target.scope is TargetScope.FILE:
            requirements = [
                "resolve-current-file-extents",
                "overwrite-addressable-data-extents",
                "overwrite-file-slack",
                "remove-filesystem-name-and-record-metadata",
                "address-journal-and-log-copies",
                "scan-unallocated-space-for-content-signatures",
                "run-post-sanitization-recovery-attempt",
            ]
            reason = (
                "Selective physical sanitization cannot be guaranteed on flash media because controller "
                "wear-leveling and spare blocks are not addressable."
                if flash_media else
                "Filesystem-specific extent and metadata sanitizers are not enabled."
            )
            return self._result(target, SanitizationMethod.CLEAR, requirements, reason)

        requirements = [
            "capture-device-identity-and-capabilities",
            "unmount-and-lock-exclusive-target",
            "sanitize-all-user-addressable-lbas",
            "address-remapped-and-overprovisioned-storage",
            "read-back-or-controller-status-verification",
            "run-post-sanitization-recovery-attempt",
        ]
        recommended = SanitizationMethod.PURGE if flash_media else SanitizationMethod.CLEAR
        reason = (
            "A controller-native purge or cryptographic erase capability must be positively detected."
            if flash_media else
            "A native whole-device provider and exclusive device lock are not enabled."
        )
        return self._result(target, recommended, requirements, reason)

    @staticmethod
    def _result(target, recommended, requirements, reason):
        return {
            "targetScope": target.scope.value,
            "artifactId": target.artifact_id,
            "recommendedMethod": recommended.value,
            "supported": False,
            "availableMethods": [],
            "mode": "DRY_RUN",
            "requirements": requirements,
            "counteredRecoveryPaths": ["filesystem-metadata-recovery", "whole-image-signature-carving"],
            "reason": reason,
        }

    @staticmethod
    def _is_flash(device) -> bool:
        description = " ".join(filter(None, [device.name, device.model, device.bus])).lower()
        return any(term in description for term in ("ssd", "nvme", "flash", "usb"))
