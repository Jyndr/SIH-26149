# 03 — API

## 1. Conventions

- Base path: `/api/v1`
- All request/response bodies are JSON unless otherwise noted (evidence upload is multipart/streaming).
- Authentication: `Authorization: Bearer <JWT>` header, unless marked **Public**.
- Every response follows the standard envelope below.
- Every list endpoint supports `?page=&limit=` pagination and returns a `meta` block with `{ page, limit, total }`.

### Standard success response
```json
{
  "success": true,
  "data": {}
}
```

### Standard error response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Safe user-facing message",
    "requestId": "..."
  }
}
```

`requestId` comes from the `requestId.middleware.js` correlation ID and is also written into the relevant `AuditLog` entry, so any error a user reports can be traced end-to-end.

Common error codes used throughout: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `PYTHON_SERVICE_ERROR` (502), `INTERNAL_ERROR` (500).

---

## 2. Authentication

### `POST /api/v1/auth/register`
- **Auth:** Public
- **Request:**
```json
{ "name": "Asha Rao", "email": "asha@example.com", "password": "min-8-chars" }
```
- **Response (201):**
```json
{ "success": true, "data": { "userId": "USR-00001", "name": "Asha Rao", "email": "asha@example.com", "role": "INVESTIGATOR" } }
```
- **Errors:** `VALIDATION_ERROR` (bad email/weak password), `CONFLICT` (email already registered)
- Notes: `role` is always forced to `INVESTIGATOR` on self-registration; only an existing `ADMIN` can elevate a role via a separate admin-only endpoint if the team decides to add one later.

### `POST /api/v1/auth/login`
- **Auth:** Public
- **Request:** `{ "email": "...", "password": "..." }`
- **Response (200):** `{ "success": true, "data": { "token": "<jwt>", "user": { "userId", "name", "email", "role" } } }`
- **Errors:** `UNAUTHORIZED` (bad credentials or inactive account)

### `GET /api/v1/auth/me`
- **Auth:** Required
- **Response (200):** current user's public profile.
- **Errors:** `UNAUTHORIZED`

---

## 3. Cases

### `POST /api/v1/cases`
- **Auth:** Required. **Authz:** any authenticated investigator.
- **Request:** `{ "title": "...", "description": "..." }`
- **Response (201):** the created case. `createdBy` is set from `req.user`, `investigators` initialized to `[req.user]`.
- **Errors:** `VALIDATION_ERROR`

### `GET /api/v1/cases`
- **Auth:** Required. Returns only cases the user is an investigator on (or all cases if `ADMIN`).
- **Query:** `?status=&page=&limit=`
- **Response (200):** paginated list of cases.

### `GET /api/v1/cases/:caseId`
- **Auth:** Required. **Authz:** must be an investigator on the case or `ADMIN`.
- **Response (200):** full case detail.
- **Errors:** `NOT_FOUND`, `FORBIDDEN`

### `PATCH /api/v1/cases/:caseId`
- **Auth:** Required. **Authz:** investigator on the case or `ADMIN`.
- **Request:** any subset of `{ title, description, status, investigators }`
- **Response (200):** updated case.
- **Errors:** `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`

---

## 4. Evidence

### `POST /api/v1/cases/:caseId/evidence`
- **Auth:** Required. **Authz:** investigator on the case.
- **Request:** multipart/form-data, streamed to disk (not buffered fully in memory). Fields: `file`, optional `description`.
- **Response (201):**
```json
{ "success": true, "data": { "evidenceId": "EVD-00123", "originalFilename": "image.E01", "size": 10485760, "sha256": "...", "analysisStatus": "PENDING" } }
```
- **Errors:** `VALIDATION_ERROR` (unsupported type/too large), `FORBIDDEN`, `CONFLICT` (duplicate `sha256` in this case)
- Notes: `sha256` is computed while streaming to disk, not after — so upload and hashing happen in a single pass. `mimeType` is detected server-side, never trusted from the multipart header.

### `GET /api/v1/cases/:caseId/evidence`
- **Auth:** Required. **Authz:** investigator on the case.
- **Response (200):** paginated list of evidence for the case.

### `GET /api/v1/evidence/:evidenceId`
- **Auth:** Required. **Authz:** investigator on the owning case.
- **Response (200):** evidence detail including `integrity` status.
- **Errors:** `NOT_FOUND`, `FORBIDDEN`

### `POST /api/v1/evidence/:evidenceId/verify`
- **Auth:** Required. **Authz:** investigator on the owning case.
- Recomputes SHA-256 of the stored file and compares against the original `sha256`, updates `integrity`.
- **Response (200):** `{ "verified": true, "currentHash": "...", "verifiedAt": "..." }`
- **Errors:** `NOT_FOUND`, `FORBIDDEN`

---

## 5. Analysis

### `POST /api/v1/evidence/:evidenceId/analyze`
- **Auth:** Required. **Authz:** investigator on the owning case.
- Creates a `Job` of type `ANALYSIS`, calls Python asynchronously, returns immediately with the job to poll/subscribe to.
- **Request:** `{ "options": {} }` (optional, forwarded to Python as-is after validation)
- **Response (202):** `{ "jobId": "JOB-00456", "status": "QUEUED" }`
- **Errors:** `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT` (analysis already running for this evidence)

---

## 6. Recovery

### `POST /api/v1/evidence/:evidenceId/recover`
- **Auth:** Required. **Authz:** investigator on the owning case.
- **Request:** `{ "options": { "fileTypes": ["JPEG", "DOCX"] } }` (optional filters)
- **Response (202):** `{ "jobId": "JOB-00457", "status": "QUEUED" }`
- **Errors:** `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT` (evidence not yet analyzed, if that's a precondition)

### `GET /api/v1/evidence/:evidenceId/recovery-results`
- **Auth:** Required. **Authz:** investigator on the owning case.
- **Response (200):** paginated list of `RecoveredFile` documents for this evidence.

### `GET /api/v1/recovered-files/:recoveredFileId`
- **Auth:** Required. **Authz:** investigator on the owning case.
- **Response (200):** single recovered file's metadata (never the raw bytes directly — download, if implemented, is a separate explicitly-scanned endpoint).
- **Errors:** `NOT_FOUND`, `FORBIDDEN`

---

## 7. Jobs

### `GET /api/v1/jobs/:jobId`
- **Auth:** Required. **Authz:** investigator on the owning case.
- **Response (200):** current job status/progress/result snapshot.
- **Errors:** `NOT_FOUND`, `FORBIDDEN`

### `GET /api/v1/jobs/:jobId/events`
- **Auth:** Required (token passed as `?token=` query param, since native `EventSource` cannot set headers). **Authz:** investigator on the owning case.
- **Protocol:** Server-Sent Events. Content-Type: `text/event-stream`.
- **Events emitted:**
```text
event: progress
data: {"progress": 42, "stage": "carving signatures"}

event: completed
data: {"status": "COMPLETED", "result": {...}}

event: failed
data: {"status": "FAILED", "error": {"code": "...", "message": "..."}}
```
- The connection closes automatically after `completed` or `failed` is emitted.
- **Errors:** `NOT_FOUND`, `FORBIDDEN` (returned as a normal JSON error before the stream is upgraded)

---

## 8. Sanitization

### `POST /api/v1/sanitize/file`
### `POST /api/v1/sanitize/folder`
### `POST /api/v1/sanitize/drive`
- **Auth:** Required. **Authz:** investigator on the case; sanitization actions should additionally require `ADMIN` or a dedicated permission flag, given how destructive they are — decide and document this explicitly before implementation.
- **Request (example, `/sanitize/file`):**
```json
{ "caseId": "CASE-2026-00042", "target": "/path/reported/by/analysis", "method": "overwrite-3-pass", "standard": "NIST 800-88" }
```
- **Response (202):** `{ "jobId": "SANJOB-00012", "status": "QUEUED" }`
- **Errors:** `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`

### `GET /api/v1/sanitize/jobs/:jobId`
- **Auth:** Required. **Authz:** investigator on the owning case.
- **Response (200):** `SanitizationJob` detail including `verification` status.
- **Errors:** `NOT_FOUND`, `FORBIDDEN`

---

## 9. Audit

### `GET /api/v1/cases/:caseId/audit`
- **Auth:** Required. **Authz:** investigator on the case.
- **Response (200):** paginated audit log entries for the case, newest first.

### `GET /api/v1/audit/:auditId`
- **Auth:** Required. **Authz:** investigator on the owning case.
- **Response (200):** single audit entry.
- **Errors:** `NOT_FOUND`, `FORBIDDEN`

### `GET /api/v1/audit/:auditId/verify`
- **Auth:** Required. **Authz:** investigator on the owning case.
- Recomputes the hash chain from the case's first audit entry up to and including this one.
- **Response (200):** `{ "valid": true, "checkedEntries": 128 }` or `{ "valid": false, "brokenAt": "AUD-00042" }`
- **Errors:** `NOT_FOUND`, `FORBIDDEN`

---

## 10. Reports

### `POST /api/v1/cases/:caseId/reports`
- **Auth:** Required. **Authz:** investigator on the case.
- **Request:** `{ "type": "CASE_SUMMARY" }`
- Creates a `Job` of type `REPORT` (report generation can be synchronous or async depending on size; documented here as async for consistency).
- **Response (202):** `{ "jobId": "JOB-00460", "status": "QUEUED" }`
- **Errors:** `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`

### `GET /api/v1/cases/:caseId/reports`
- **Auth:** Required. **Authz:** investigator on the case.
- **Response (200):** paginated list of generated reports for the case.

### `GET /api/v1/reports/:reportId`
- **Auth:** Required. **Authz:** investigator on the owning case.
- **Response (200):** report metadata including `hash`.
- **Errors:** `NOT_FOUND`, `FORBIDDEN`

### `GET /api/v1/reports/:reportId/download`
- **Auth:** Required. **Authz:** investigator on the owning case.
- Streams the report file with `Content-Disposition: attachment`.
- **Errors:** `NOT_FOUND`, `FORBIDDEN`

---

## 11. Cross-Cutting Notes

- **Authorization pattern:** every resource-scoped route (`:caseId`, `:evidenceId`, `:jobId`, etc.) resolves the owning case first and checks the authenticated user is listed in `investigators` (or is `ADMIN`) before touching data — this check lives in `authorize.middleware.js` or the relevant service, never duplicated ad-hoc per controller.
- **Async operations always return 202 + jobId.** The frontend is expected to either poll `GET /jobs/:jobId` or subscribe to `GET /jobs/:jobId/events`. No endpoint blocks the HTTP request while Python does forensic work.
- **Destructive operations (sanitization) get an extra authorization layer** beyond ordinary case access, since they are irreversible.
