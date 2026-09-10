import platform
from threading import RLock

from native_agent.core.models import DevicePublic
from .linux import LinuxDeviceAdapter
from .macos import MacOSDeviceAdapter
from .windows import WindowsDeviceAdapter


class DeviceRegistry:
    def __init__(self):
        adapters = {"Linux": LinuxDeviceAdapter, "Darwin": MacOSDeviceAdapter, "Windows": WindowsDeviceAdapter}
        adapter_type = adapters.get(platform.system())
        if adapter_type is None:
            raise RuntimeError(f"Unsupported operating system: {platform.system()}")
        self._adapter = adapter_type()
        self._records = {}
        self._lock = RLock()

    def refresh(self):
        records = self._adapter.discover()
        with self._lock:
            self._records = {record.id: record for record in records}
        return records

    def list_public(self) -> list[DevicePublic]:
        return [self.to_public(record) for record in self.refresh()]

    def get(self, device_id: str):
        self.refresh()
        with self._lock:
            record = self._records.get(device_id)
        if record is None:
            raise KeyError("Unknown or disconnected device")
        return record

    @staticmethod
    def to_public(record) -> DevicePublic:
        return DevicePublic(
            id=record.id, name=record.name, vendor=record.vendor, model=record.model, serial=record.serial,
            size=record.size, bus=record.bus, removable=record.removable, filesystem=record.filesystem,
            mountPoint=record.mount_point, mounted=bool(record.mount_point), readOnly=record.read_only,
        )

