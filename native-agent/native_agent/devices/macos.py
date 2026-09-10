import plistlib
import subprocess

from .base import DeviceAdapter, DeviceRecord
from .common import safe_device_id


class MacOSDeviceAdapter(DeviceAdapter):
    def discover(self) -> list[DeviceRecord]:
        result = subprocess.run(["diskutil", "list", "-plist"], check=True, capture_output=True, timeout=10)
        listing = plistlib.loads(result.stdout)
        records = []
        for disk in listing.get("AllDisksAndPartitions", []):
            identifier = disk.get("DeviceIdentifier")
            if not identifier:
                continue
            path = f"/dev/r{identifier}"
            info_result = subprocess.run(
                ["diskutil", "info", "-plist", f"/dev/{identifier}"], check=True, capture_output=True, timeout=10
            )
            info = plistlib.loads(info_result.stdout)
            records.append(DeviceRecord(
                id=safe_device_id("macos", path, info.get("DiskUUID")),
                name=info.get("MediaName") or identifier, device_path=path,
                vendor=info.get("DeviceVendor"), model=info.get("MediaName"), serial=info.get("DiskUUID"),
                size=int(info.get("TotalSize") or disk.get("Size") or 0), bus=info.get("BusProtocol"),
                removable=bool(info.get("RemovableMedia") or info.get("Ejectable")),
                filesystem=info.get("FilesystemType"), mount_point=info.get("MountPoint"),
                read_only=bool(info.get("ReadOnlyMedia")),
            ))
        return records
