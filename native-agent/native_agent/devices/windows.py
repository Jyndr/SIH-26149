import json
import subprocess

from .base import DeviceAdapter, DeviceRecord
from .common import safe_device_id


class WindowsDeviceAdapter(DeviceAdapter):
    def discover(self) -> list[DeviceRecord]:
        script = "Get-CimInstance Win32_DiskDrive | Select-Object DeviceID,Model,Manufacturer,SerialNumber,Size,InterfaceType,MediaType | ConvertTo-Json -Compress"
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
            check=True, capture_output=True, text=True, timeout=15,
        )
        payload = json.loads(result.stdout or "[]")
        devices = payload if isinstance(payload, list) else [payload]
        records = []
        for item in devices:
            path = item.get("DeviceID")
            if not path:
                continue
            serial = (item.get("SerialNumber") or "").strip() or None
            bus = (item.get("InterfaceType") or "").upper() or None
            records.append(DeviceRecord(
                id=safe_device_id("windows", path, serial), name=item.get("Model") or "Storage device", device_path=path,
                vendor=item.get("Manufacturer"), model=item.get("Model"), serial=serial, size=int(item.get("Size") or 0),
                bus=bus, removable=bus == "USB" or "removable" in (item.get("MediaType") or "").lower(), read_only=False,
            ))
        return records

