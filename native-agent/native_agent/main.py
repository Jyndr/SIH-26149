from fastapi import Depends, FastAPI, Header, HTTPException

from .acquisition.service import AcquisitionService
from .audit.service import AuditWriter
from .core.config import AGENT_TOKEN, AUDIT_DIR, IMAGE_DIR
from .core.models import AcquisitionRequest, SanitizationRequest, VerificationRequest
from .devices import DeviceRegistry
from .sanitization.service import SanitizationService
from .verification.service import VerificationService


app = FastAPI(title="Cyphora Native Agent", version="0.1.0", docs_url=None, redoc_url=None)
registry = DeviceRegistry()
audit = AuditWriter(AUDIT_DIR)
acquisition = AcquisitionService(registry, IMAGE_DIR, audit)
sanitization = SanitizationService(registry, audit)
verification = VerificationService(audit)


def authorize(x_cyphora_agent_token: str | None = Header(default=None)):
    if AGENT_TOKEN and x_cyphora_agent_token != AGENT_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid native-agent token")


def invoke(action):
    try:
        return action()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (OSError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/health", dependencies=[Depends(authorize)])
def health():
    return {"status": "ok", "service": "cyphora-native-agent", "destructiveOperationsEnabled": False}


@app.get("/devices", dependencies=[Depends(authorize)])
def list_devices():
    return invoke(lambda: registry.list_public())


@app.get("/devices/{device_id}", dependencies=[Depends(authorize)])
def get_device(device_id: str):
    return invoke(lambda: registry.to_public(registry.get(device_id)))


@app.post("/acquisition/prepare", dependencies=[Depends(authorize)])
def prepare_acquisition(request: AcquisitionRequest):
    return invoke(lambda: acquisition.prepare(request))


@app.post("/acquisition/start", status_code=202, dependencies=[Depends(authorize)])
def start_acquisition(request: AcquisitionRequest):
    return invoke(lambda: acquisition.start(request))


@app.get("/acquisition/{job_id}", dependencies=[Depends(authorize)])
def get_acquisition(job_id: str):
    return invoke(lambda: acquisition.get(job_id))


@app.post("/sanitization/prepare", dependencies=[Depends(authorize)])
def prepare_sanitization(request: SanitizationRequest):
    return invoke(lambda: sanitization.prepare(request))


@app.post("/sanitization/start", status_code=202, dependencies=[Depends(authorize)])
def start_sanitization(request: SanitizationRequest):
    return invoke(lambda: sanitization.start(request))


@app.get("/sanitization/{job_id}", dependencies=[Depends(authorize)])
def get_sanitization(job_id: str):
    return invoke(lambda: sanitization.get(job_id))


@app.post("/verification/start", dependencies=[Depends(authorize)])
def start_verification(request: VerificationRequest):
    return verification.start(request)

