from eraser import MockSanitizationProvider, OverwriteSanitizationProvider, SanitizationMethod, SanitizationTarget, TargetScope
from native_agent.core.config import ENABLE_DESTRUCTIVE_ERASURE


class SanitizationService:
    def __init__(self, registry, audit):
        self._registry = registry
        self._audit = audit
        self._provider = MockSanitizationProvider()
        self._live_provider = OverwriteSanitizationProvider(ENABLE_DESTRUCTIVE_ERASURE)
        self._jobs = {}

    def prepare(self, request):
        device = self._registry.get(request.deviceId)
        target = self._target(request)
        result = self._live_provider.inspect(device, target)
        self._audit.record("SANITIZATION_PREPARE", request.caseId, device.id, result)
        return result

    def start(self, request):
        device = self._registry.get(request.deviceId)
        method = SanitizationMethod(request.method) if request.method else None
        execute = getattr(request, "execute", False)
        provider = self._live_provider if execute else self._provider
        if execute:
            result = provider.sanitize(device, request.caseId, method, self._target(request), request.confirmation)
        else:
            result = provider.sanitize(device, request.caseId, method, self._target(request))
        self._jobs[result["jobId"]] = result
        self._audit.record("SANITIZATION", request.caseId, device.id, result)
        return result

    def get(self, job_id):
        if job_id not in self._jobs:
            raise KeyError("Sanitization job not found")
        return self._jobs[job_id]

    @staticmethod
    def _target(request):
        return SanitizationTarget(request.deviceId, TargetScope(request.targetScope), request.artifactId)
