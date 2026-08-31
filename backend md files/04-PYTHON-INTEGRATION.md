# 04 — Python Integration

## 1. Purpose

This is the contract between the Node backend and the Python forensic service. Both teams should treat this file as the source of truth — if either side needs to change a shape, this file gets updated first, in a PR both teams review, before code changes.

**Transport:** plain HTTP/REST, Node as client, Python as server. No Redis, no Kafka, no message queue. At hackathon scale, a queue adds operational complexity (another process to run, another failure mode to demo around) without solving a problem Node + async HTTP + polling/SSE doesn't already solve. If load testing later reveals a real need for a queue, that's a Phase-13-and-beyond decision, not a v1 one.

---

## 2. Python Service Surface

```text
GET  /internal/health

POST /internal/v1/analyze
POST /internal/v1/recover
POST /internal/v1/sanitize
POST /internal/v1/verify

GET  /internal/v1/jobs/:pythonJobId
```

The `/internal/` prefix signals this API is not public-facing — it should not be reachable from the internet in deployment, only from the Node backend's network.

---

## 3. Request Shape (Node → Python)

Every operation (`analyze`, `recover`, `sanitize`, `verify`) uses the same envelope, varying only in `operation` and the contents of `options`:

```json
{
  "jobId": "JOB-00456",
  "operation": "recover",
  "evidence": {
    "evidenceId": "EVD-00123",
    "path": "/storage/evidence/EVD-00123/image.E01",
    "sha256": "b1946ac92492d2347c6235b4d2611184..."
  },
  "options": {}
}
```

- `jobId` is Node's own `Job.jobId` — Python should echo it back in every progress/result callback so Node can correlate without a lookup.
- `path` is the server-side storage path, resolved by Node — Python trusts this path came from Node, not from a browser.
- `sha256` lets Python (and Node) sanity-check they're both looking at the exact same bytes before doing expensive work on them.
- `options` is operation-specific and validated by Node's Zod schemas *before* being forwarded, so Python never receives arbitrary unvalidated client input, even indirectly.

For `sanitize`, `evidence` is replaced by a `target` block (`{ target, targetType, deviceType, filesystem, method, standard }`) matching `SanitizationJob` fields, since sanitization isn't always tied to an `Evidence` record (e.g. wiping a whole drive).

---

## 4. Accepted Response (Python → Node, synchronous ack)

Python acknowledges receipt immediately, before doing the actual work:

```json
{
  "accepted": true,
  "pythonJobId": "PY-00789"
}
```

Node stores `pythonJobId` on the `Job` document immediately. If `accepted` is `false` or the HTTP call fails outright, Node marks the `Job` `FAILED` with `error.code = "PYTHON_SERVICE_ERROR"` and does not retry automatically for that request (see Section 7).

---

## 5. Result Shapes (Python → Node)

Python reports final results either via a webhook-style callback to a Node endpoint (`POST /internal/v1/jobs/callback`, recommended for a hackathon build — simpler than Node polling Python) **or** Node polls `GET /internal/v1/jobs/:pythonJobId` until `status` is terminal. Pick one for the actual build; a callback is simpler to implement and demo, but document polling here too since it's a reasonable fallback if the Python side can't easily make outbound calls.

### Analysis result
```json
{
  "status": "completed",
  "filesystem": "NTFS",
  "summary": {
    "totalFiles": 12482,
    "deletedFiles": 347,
    "recoveredFiles": 281
  }
}
```

### Recovery result
```json
{
  "status": "completed",
  "files": [
    {
      "filename": "photo.jpg",
      "fileType": "JPEG",
      "size": 245678,
      "recoveryMethod": "signature-carving",
      "confidence": 0.97,
      "path": "/recovered/photo.jpg"
    }
  ]
}
```
Node turns each entry in `files` into one `RecoveredFile` document, re-deriving `storagePath` itself rather than trusting Python's `path` verbatim (Python's `path` is treated as "where Python wrote it," which Node then validates is inside the expected `storage/recovered/` tree before recording it).

### Sanitization result
```json
{
  "status": "completed",
  "verification": { "verified": true, "method": "read-back-zero-check" }
}
```

### Verification result
```json
{
  "status": "completed",
  "verified": true,
  "currentHash": "..."
}
```

All result payloads share `status: "completed" | "failed"`; on `"failed"`, Python includes `{ "error": { "code": "...", "message": "..." } }`, which Node maps directly into `Job.error`.

---

## 6. End-to-End Flow

```text
React
  ↓  POST /evidence/:id/recover
Node: create Job (QUEUED), validate options
  ↓
Node → Python: POST /internal/v1/recover
  ↓
Python: accepted, returns pythonJobId
  ↓
Node: Job.status = RUNNING, store pythonJobId
  ↓
Python processes (long-running)
  ↓ (progress callbacks, optional)          ↓ (final callback or Node polls)
Node: Job.progress updated, SSE emits    Node receives result
                                              ↓
                                          Node validates result shape (Zod)
                                              ↓
                                          Node writes RecoveredFile docs + updates Job
                                              ↓
                                          Node writes AuditLog entry
                                              ↓
                                          SSE emits "completed" / next GET /jobs/:id reflects it
                                              ↓
                                          React
```

Every result from Python is validated against a Zod schema on the Node side before it touches MongoDB — Python is a trusted internal service, but "trusted" doesn't mean "unvalidated," since a bug on the Python side (or a future compromise) shouldn't be able to write malformed data into the case record or crash the Node process.

---

## 7. Failure Handling

| Scenario | Node behavior |
|---|---|
| **Timeout** on the initial accept call | Configurable timeout (e.g. 10s) on the accept request only — this call should be fast since Python just needs to say "got it, starting." Job marked `FAILED`, `error.code = "PYTHON_TIMEOUT"`. |
| **Retries** | The accept call may be retried a small, fixed number of times (e.g. 2) with backoff, only for network-level failures (connection refused/reset), never for 4xx responses. The long-running operation itself is not retried automatically — a failed recovery/sanitization requires an explicit new request, since silently re-running a sanitization job is dangerous. |
| **Python unavailable** | Health check (`GET /internal/health`) is polled on Node startup and optionally on an interval; if Python is down when a job is requested, Node fails fast with `PYTHON_SERVICE_ERROR` (503-equivalent) instead of queuing a job that can never start. |
| **Malformed Python response** | Zod validation fails → Job marked `FAILED` with `error.code = "INVALID_PYTHON_RESPONSE"`; raw payload logged (not stored on the Job document) for debugging. Node never trusts an unvalidated shape into the DB. |
| **Job fails on Python's side** | Python's own `status: "failed"` result is mapped straight into `Job.status = FAILED` / `Job.error`. |
| **Cancellation** | Node exposes no public cancel endpoint in v1 unless explicitly needed; if added later, it calls a `DELETE /internal/v1/jobs/:pythonJobId` on Python and marks `Job.status = CANCELLED` optimistically, since forensic operations may not be safely interruptible mid-way. |
| **Idempotency** | Every request to Python carries Node's `jobId`, which Python should treat as an idempotency key — if Python receives the same `jobId` twice (e.g. due to a Node-side retry after a dropped response), it should return the existing `pythonJobId` rather than starting duplicate work. |
| **Correlation IDs** | The `requestId` from `requestId.middleware.js` is forwarded to Python as an `X-Request-Id` header on every call, and Python is asked to echo it back in logs/responses, so a single user action can be traced across both services' logs. |

---

## 8. Authentication Between Node and Python

Since `/internal/` endpoints should not be public, authenticate service-to-service calls with a shared secret rather than a full OAuth flow — appropriate for a hackathon prototype where both services typically run on the same trusted network/VM:

- Node sends `X-Internal-Token: <PYTHON_SERVICE_TOKEN>` on every call.
- Python rejects any request missing or mismatching this token with 401.
- The token lives in both services' `.env` files (`PYTHON_SERVICE_TOKEN`), never committed, never logged.

This is intentionally simple. If the deployment environment later exposes the Python service beyond a private network, this should be upgraded (mTLS or a proper service-auth scheme) — but that upgrade doesn't change this document's request/response contracts, only the transport-level auth.

---

## 9. Health Checks

`GET /internal/health` should return `{ "status": "ok", "version": "..." }` with no auth required (safe to expose since it reveals nothing sensitive), so Node's own `/api/v1/health` (if it aggregates dependency health) and any monitoring/demo dashboard can show "Python service: up/down" at a glance — useful during a live hackathon demo when things go wrong.

---

## 10. The `pythonClient` Abstraction

No controller and no other service calls Python's HTTP API directly. Everything goes through:

```text
controller
   ↓
recoveryService / analysisService / sanitizationService / verificationService
   ↓
pythonClient  (services/python/pythonClient.js)
   ↓
Python API
```

`pythonClient.js` owns: base URL from config, the shared-secret header, timeout/retry logic from Section 7, and request/response logging keyed by `requestId`. It exposes one function per operation (`analyze()`, `recover()`, `sanitize()`, `verify()`, `getJobStatus()`), each returning a plain validated JS object — callers never see raw HTTP or axios/fetch details.

**Why this matters:** if the Python team changes a URL path, a header name, or the transport entirely (e.g. adds a queue later), exactly one file changes. No controller, service, or test elsewhere in the Node codebase needs to know Python exists at all beyond calling `recoveryService.startRecovery(...)`.
