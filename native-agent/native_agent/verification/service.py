class VerificationService:
    def __init__(self, audit):
        self._audit = audit

    def start(self, request):
        result = {"sanitizationJobId": request.sanitizationJobId, "caseId": request.caseId,
                  "executed": False, "verificationStatus": "NOT_EXECUTED", "status": "NOT_EXECUTED",
                  "reason": "No sanitization was executed in DRY_RUN mode."}
        self._audit.record("VERIFICATION", request.caseId, request.sanitizationJobId, result)
        return result

