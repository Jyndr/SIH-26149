import hashlib
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock, Thread
from uuid import uuid4


class AcquisitionService:
    def __init__(self, registry, image_dir: Path, audit):
        self._registry = registry
        self._image_dir = image_dir
        self._audit = audit
        self._jobs = {}
        self._lock = RLock()

    def prepare(self, request):
        device = self._registry.get(request.deviceId)
        if not device.removable and (device.bus or "").upper() != "USB":
            raise ValueError("Acquisition is limited to removable or USB devices")
        if request.imageFormat == "E01":
            raise ValueError("E01 provider is not enabled; select RAW or IMG")
        return {"device": self._registry.to_public(device), "imageFormat": request.imageFormat, "readOnly": True,
                "sourceSize": device.size, "status": "READY"}

    def start(self, request):
        plan = self.prepare(request)
        job_id = f"ACQ-{uuid4().hex}"
        extension = ".img" if request.imageFormat in {"RAW", "IMG"} else ".e01"
        output = (self._image_dir / f"{job_id}{extension}").resolve()
        if self._image_dir.resolve() not in output.parents:
            raise ValueError("Invalid acquisition output path")
        job = {"jobId": job_id, "acquisitionId": job_id, "caseId": request.caseId, "sourceDevice": request.deviceId,
               "sourceSize": plan["sourceSize"], "imagePath": None, "imageFormat": request.imageFormat,
               "startedAt": datetime.now(timezone.utc).isoformat(), "completedAt": None, "sha256": None,
               "bytesRead": 0, "status": "QUEUED", "error": None}
        with self._lock:
            self._jobs[job_id] = job
        Thread(target=self._copy, args=(job_id, output), daemon=True).start()
        return dict(job)

    def get(self, job_id):
        with self._lock:
            if job_id not in self._jobs:
                raise KeyError("Acquisition job not found")
            return dict(self._jobs[job_id])

    def _copy(self, job_id, output):
        with self._lock:
            job = self._jobs[job_id]
            job["status"] = "RUNNING"
        digest = hashlib.sha256()
        try:
            device = self._registry.get(job["sourceDevice"])
            with open(device.device_path, "rb", buffering=0) as source, output.open("xb") as destination:
                while True:
                    chunk = source.read(4 * 1024 * 1024)
                    if not chunk:
                        break
                    destination.write(chunk)
                    digest.update(chunk)
                    with self._lock:
                        job["bytesRead"] += len(chunk)
            completed = datetime.now(timezone.utc).isoformat()
            with self._lock:
                job.update(status="COMPLETED", imagePath=str(output), sha256=digest.hexdigest(), completedAt=completed)
            self._audit.record("ACQUISITION", job["caseId"], job["sourceDevice"], {
                "mode": "READ_ONLY", "imageFormat": job["imageFormat"], "sha256": job["sha256"],
                "startedAt": job["startedAt"], "completedAt": completed, "status": "COMPLETED",
            })
        except Exception as exc:
            output.unlink(missing_ok=True)
            with self._lock:
                job.update(status="FAILED", error=str(exc), completedAt=datetime.now(timezone.utc).isoformat())
            self._audit.record("ACQUISITION", job["caseId"], job["sourceDevice"], {
                "mode": "READ_ONLY", "executed": False, "status": "FAILED", "error": str(exc),
            })

