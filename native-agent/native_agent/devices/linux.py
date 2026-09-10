import json
import subprocess

from .base import DeviceAdapter, DeviceRecord
from .common import safe_device_id


class LinuxDeviceAdapter(DeviceAdapter):
    def discover(self) -> list[DeviceRecord]:
        result = subprocess.run(
            ["lsblk", "-J", "-b", "-o", "NAME,PATH,VENDOR,MODEL,SERIAL,SIZE,TRAN,RM,RO,FSTYPE,MOUNTPOINT,TYPE"],
            check=True, capture_output=True, text=True, timeout=10,
        )
        records = []
        for item in json.loads(result.stdout).get("blockdevices", []):
            if item.get("type") != "disk":
                continue
            children = item.get("children") or []
            filesystem = next((c.get("fstype") for c in children if c.get("fstype")), item.get("fstype"))
            mount_point = next((c.get("mountpoint") for c in children if c.get("mountpoint")), item.get("mountpoint"))
            path = item.get("path")
            if not path:
                continue
            serial = (item.get("serial") or "").strip() or None
            records.append(DeviceRecord(
                id=safe_device_id("linux", path, serial), name=(item.get("model") or item.get("name") or "Storage device").strip(),
                device_path=path, vendor=(item.get("vendor") or "").strip() or None,
                model=(item.get("model") or "").strip() or None, serial=serial, size=int(item.get("size") or 0),
                bus=(item.get("tran") or "").upper() or None, removable=bool(item.get("rm")), filesystem=filesystem,
                mount_point=mount_point, read_only=bool(item.get("ro")),
            ))
        return records

