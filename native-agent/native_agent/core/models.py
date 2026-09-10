from typing import Literal, Optional
from pydantic import BaseModel, Field


class DevicePublic(BaseModel):
    id: str
    name: str
    vendor: Optional[str] = None
    model: Optional[str] = None
    serial: Optional[str] = None
    size: int = 0
    bus: Optional[str] = None
    removable: bool = False
    filesystem: Optional[str] = None
    mountPoint: Optional[str] = None
    mounted: bool = False
    readOnly: bool = False
    status: str = "CONNECTED"


class AcquisitionRequest(BaseModel):
    deviceId: str = Field(min_length=8, max_length=128)
    caseId: str = Field(min_length=1, max_length=128)
    imageFormat: Literal["RAW", "IMG", "E01"] = "RAW"


class SanitizationRequest(BaseModel):
    deviceId: str = Field(min_length=8, max_length=128)
    caseId: str = Field(min_length=1, max_length=128)
    method: Optional[Literal["CLEAR", "PURGE", "CRYPTOGRAPHIC_ERASE", "DESTROY"]] = None
    targetScope: Literal["FILE", "DEVICE"] = "DEVICE"
    artifactId: Optional[str] = Field(default=None, min_length=1, max_length=256)
    execute: bool = False
    confirmation: Optional[str] = Field(default=None, min_length=1, max_length=256)


class VerificationRequest(BaseModel):
    sanitizationJobId: str = Field(min_length=1, max_length=128)
    caseId: str = Field(min_length=1, max_length=128)
