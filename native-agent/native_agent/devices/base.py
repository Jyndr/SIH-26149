from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class DeviceRecord:
    id: str
    name: str
    device_path: str
    vendor: Optional[str] = None
    model: Optional[str] = None
    serial: Optional[str] = None
    size: int = 0
    bus: Optional[str] = None
    removable: bool = False
    filesystem: Optional[str] = None
    mount_point: Optional[str] = None
    read_only: bool = False


class DeviceAdapter(ABC):
    @abstractmethod
    def discover(self) -> list[DeviceRecord]:
        raise NotImplementedError

