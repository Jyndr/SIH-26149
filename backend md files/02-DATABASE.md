# 02 — Database

## 1. Purpose

Defines every MongoDB collection the Node backend owns, via Mongoose schemas. The Python service never talks to MongoDB directly — it receives data over HTTP and returns results over HTTP; Node is the only writer.

General conventions used everywhere below:
- Every schema uses Mongoose's built-in `_id` (ObjectId) as the real primary key. The `xxxId`-style fields shown (e.g. `caseId`) are **human-readable, generated identifiers** (e.g. `CASE-2026-00123`) used in URLs, UI, and audit logs, stored as an indexed unique string alongside `_id`.
- All schemas use `{ timestamps: true }` for `createdAt`/`updatedAt` instead of declaring them manually.
- Fields marked **[server-only]** must never be accepted from client input — they are always set by the backend from `req.user` or generated internally, even if the client sends a value for them.

---

## 2. User

**Purpose:** authentication and role-based access.

| Field | Type | Notes |
|---|---|---|
| `userId` | String, unique, indexed | e.g. `USR-00001`, generated on create |
| `name` | String, required | |
| `email` | String, required, unique, indexed | lowercased before save |
| `passwordHash` | String, required | bcrypt hash, **never returned in any API response** |
| `role` | String enum: `INVESTIGATOR`, `ANALYST`, `ADMIN` | default `INVESTIGATOR` |
| `isActive` | Boolean | default `true`; disabled accounts can't log in |

**Relationships:** referenced by `Case.createdBy`, `Case.investigators`, `Evidence.createdBy`, `Job.createdBy`, `AuditLog.actor`.

**Indexes:** unique on `email`, unique on `userId`.

**Not trusted from client:** `role` (only an ADMIN can set another user's role; self-registration always creates `INVESTIGATOR`), `passwordHash` (always derived server-side from a plaintext `password` field in the request, then discarded), `isActive`.

---

## 3. Case

**Purpose:** the top-level investigation container. Everything else (evidence, jobs, reports, audit entries) belongs to a case.

| Field | Type | Notes |
|---|---|---|
| `caseId` | String, unique, indexed | e.g. `CASE-2026-00042` |
| `title` | String, required | |
| `description` | String | |
| `createdBy` | ObjectId → User | **[server-only]**, set from `req.user` |
| `investigators` | [ObjectId → User] | users allowed to act on this case |
| `status` | enum: `OPEN`, `IN_PROGRESS`, `CLOSED`, `ARCHIVED` | default `OPEN` |

**Relationships:** parent of Evidence, Job, RecoveredFile, SanitizationJob, AuditLog, Report (all reference `caseId`).

**Indexes:** unique on `caseId`; compound index on `(status, createdAt)` for dashboard listing.

**Not trusted from client:** `createdBy`, `caseId` (server-generated), `status` transitions should go through service logic, not arbitrary client PATCH values.

---

## 4. Evidence

**Purpose:** metadata about an uploaded piece of digital evidence (a disk image, a file, etc.). The actual bytes live in `storage/evidence/`, never in MongoDB.

| Field | Type | Notes |
|---|---|---|
| `evidenceId` | String, unique, indexed | e.g. `EVD-00123` |
| `caseId` | ObjectId → Case, required, indexed | |
| `originalFilename` | String | as uploaded by the client — **display only, never used to build a filesystem path** |
| `storedFilename` | String | **[server-only]**, server-generated (e.g. `evidenceId` + extension) |
| `size` | Number | bytes, computed server-side from the uploaded stream |
| `mimeType` | String | **[server-only]**, detected server-side (e.g. via magic bytes), never trusted from the `Content-Type` header alone |
| `sha256` | String | **[server-only]**, computed server-side while streaming to disk |
| `storagePath` | String | **[server-only]**, relative path under `storage/evidence/`, never exposed raw to the frontend |
| `filesystem` | String | filled in after analysis (e.g. `NTFS`, `ext4`) — comes from the Python result, not the client |
| `analysisStatus` | enum: `PENDING`, `ANALYZING`, `ANALYZED`, `FAILED` | default `PENDING` |
| `integrity` | subdocument: `{ verified: Boolean, verifiedAt: Date, currentHash: String }` | tracks whether stored evidence still matches `sha256` |
| `createdBy` | ObjectId → User | **[server-only]** |

**Relationships:** child of Case; parent of Job (via `evidenceId`), RecoveredFile.

**Indexes:** unique on `evidenceId`; compound `(caseId, createdAt)`; unique on `sha256` **within a case** (a compound unique index on `(caseId, sha256)`) to prevent accidental duplicate uploads of the same evidence into one case.

**Not trusted from client:** `storedFilename`, `storagePath`, `sha256`, `mimeType`, `filesystem`, `analysisStatus`, `createdBy`, `caseId` ownership (must be verified against the authenticated user's access to that case before any write).

---

## 5. Job

**Purpose:** a single generic model for every long-running forensic operation (analysis, recovery, carving, sanitization, verification, report generation), rather than a separate collection per operation type. This keeps job-tracking, SSE progress, and Python-call bookkeeping in one place.

| Field | Type | Notes |
|---|---|---|
| `jobId` | String, unique, indexed | e.g. `JOB-00456` |
| `caseId` | ObjectId → Case, required, indexed | |
| `evidenceId` | ObjectId → Evidence | optional — not all jobs (e.g. drive-level sanitization) are tied to an Evidence record |
| `type` | enum: `ANALYSIS`, `RECOVERY`, `CARVING`, `SANITIZATION`, `VERIFICATION`, `REPORT` | |
| `status` | enum: `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` | default `QUEUED` |
| `progress` | Number, 0–100 | updated as Python reports progress |
| `stage` | String | free-text human-readable current stage, e.g. `"carving signatures"` |
| `pythonJobId` | String | the correlation ID returned by the Python service |
| `result` | Mixed | validated summary of the Python result once completed (shape depends on `type`) |
| `error` | subdocument: `{ code: String, message: String }` | populated on `FAILED` |
| `startedAt` | Date | |
| `completedAt` | Date | |
| `createdBy` | ObjectId → User | **[server-only]** |

**Why one generic Job model:** analysis, recovery, carving, sanitization, and verification all share the same lifecycle (queued → running → completed/failed), the same progress-reporting shape, and the same relationship to a Python call. A separate collection per type would mean duplicating that lifecycle logic five times for no real benefit at hackathon scale. `type` plus a loosely-typed `result` field is enough to keep them distinguishable while sharing one service (`job.service.js`) for all state transitions.

**Relationships:** child of Case and (optionally) Evidence; parent of RecoveredFile (via `jobId`).

**Indexes:** unique on `jobId`; compound `(caseId, type, status)` for dashboards; index on `pythonJobId` for fast lookup when Python calls back.

**Not trusted from client:** everything except the initial trigger fields (`caseId`, `evidenceId`, `type`, and operation-specific `options`) — `status`, `progress`, `result`, `pythonJobId` are always written by the backend based on Python responses, never by client requests.

---

## 6. RecoveredFile

**Purpose:** one document per file recovered by the Python service during a `RECOVERY` or `CARVING` job.

| Field | Type | Notes |
|---|---|---|
| `recoveredFileId` | String, unique, indexed | |
| `caseId` | ObjectId → Case, indexed | |
| `evidenceId` | ObjectId → Evidence, indexed | |
| `jobId` | ObjectId → Job, indexed | |
| `filename` | String | as reported by Python — **sanitized before storage/display, never trusted for path construction** |
| `fileType` | String | e.g. `JPEG`, `DOCX` |
| `size` | Number | |
| `recoveryMethod` | String | e.g. `signature-carving`, `filesystem-metadata` |
| `status` | enum: `RECOVERED`, `PARTIAL`, `CORRUPTED` | |
| `confidence` | Number, 0–1 | Python's confidence score |
| `sha256` | String | computed by Python, re-verifiable by Node |
| `storagePath` | String | **[server-only]** path under `storage/recovered/` |
| `validation` | subdocument: `{ scanned: Boolean, safeToDownload: Boolean }` | see Section 8, security notes |

**Relationships:** child of Case, Evidence, and Job.

**Indexes:** unique on `recoveredFileId`; compound `(jobId, status)`.

**Not trusted from client:** this entire collection is write-only from the Python integration path (via `recovery.service.js`), never created or edited directly from a client request.

---

## 7. SanitizationJob

**Purpose:** tracks a data-wiping operation and its verification, kept separate from the generic `Job` model because sanitization has a materially different shape (target device/file, wipe standard) and different compliance/audit weight — it is the kind of record that may need to be produced as evidence of proper data destruction.

| Field | Type | Notes |
|---|---|---|
| `jobId` | String, unique, indexed | its own ID space, separate from generic `Job.jobId` |
| `caseId` | ObjectId → Case, indexed | |
| `target` | String | path or device identifier being sanitized |
| `targetType` | enum: `FILE`, `FOLDER`, `DRIVE` | |
| `deviceType` | String | e.g. `HDD`, `SSD`, `USB` — affects which wipe method is valid |
| `filesystem` | String | |
| `method` | String | wipe method used, e.g. `overwrite-3-pass`, `secure-erase` |
| `standard` | String | compliance standard referenced, e.g. `NIST 800-88` |
| `status` | enum: `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED` | |
| `verification` | subdocument: `{ verified: Boolean, method: String, verifiedAt: Date }` | result of the post-wipe verification step |
| `createdBy` | ObjectId → User | **[server-only]** |

**Relationships:** child of Case.

**Indexes:** unique on `jobId`; compound `(caseId, status)`.

**Not trusted from client:** `status`, `verification`, `createdBy` — the client can only request a sanitization with `target`, `targetType`, `deviceType`, `method`, `standard`.

---

## 8. AuditLog

**Purpose:** append-only, tamper-evident log of every significant action in the system. This is central to a digital forensics tool — investigators and courts need to trust that the audit trail itself hasn't been altered.

| Field | Type | Notes |
|---|---|---|
| `auditId` | String, unique, indexed | |
| `caseId` | ObjectId → Case, indexed | |
| `evidenceId` | ObjectId → Evidence | optional |
| `jobId` | ObjectId → Job | optional |
| `actor` | ObjectId → User | **[server-only]**, always `req.user`, never client-supplied |
| `operation` | String | e.g. `EVIDENCE_UPLOADED`, `RECOVERY_STARTED`, `SANITIZATION_COMPLETED` |
| `target` | String | human-readable description of what was acted on |
| `result` | enum: `SUCCESS`, `FAILURE` | |
| `details` | Mixed | operation-specific extra context |
| `timestamp` | Date | **[server-only]**, server clock, not client-supplied |
| `previousHash` | String | SHA-256 of the previous audit entry's `recordHash` |
| `recordHash` | String | SHA-256 of this entry's own content + `previousHash` |

**Hash chain:** each new entry hashes in the previous entry's hash, forming a chain (similar in spirit to a blockchain, without needing one). Verifying the chain (`GET /audit/:auditId/verify`) means recomputing hashes forward from the first entry and confirming no entry was altered or removed. This satisfies "tamper-evident" without any distributed ledger infrastructure — a plain hash chain in MongoDB is sufficient at this scale and is far easier for a student team to build, test, and explain to judges.

**Relationships:** references Case, Evidence, Job, User — but is never referenced *by* them, since audit logs must never be editable through normal update paths on those models.

**Indexes:** unique on `auditId`; compound `(caseId, timestamp)`.

**Not trusted from client:** the entire collection. AuditLog entries are only ever created by `audit.service.js`, called internally by other services after an action succeeds or fails — never via a direct public "create audit entry" endpoint.

---

## 9. Report

**Purpose:** metadata for a generated case report (PDF/document produced from case + evidence + job + audit data).

| Field | Type | Notes |
|---|---|---|
| `reportId` | String, unique, indexed | |
| `caseId` | ObjectId → Case, indexed | |
| `type` | enum: `CASE_SUMMARY`, `RECOVERY_REPORT`, `SANITIZATION_CERTIFICATE`, `AUDIT_REPORT` | |
| `generatedAt` | Date | **[server-only]** |
| `filePath` | String | **[server-only]** path under `storage/reports/` |
| `hash` | String | SHA-256 of the generated file, so a report's integrity can itself be verified later |
| `createdBy` | ObjectId → User | **[server-only]** |

**Relationships:** child of Case.

**Indexes:** unique on `reportId`; compound `(caseId, type)`.

**Not trusted from client:** everything except `type` — the client requests a report be generated of a given type; every other field is set by `report.service.js`.

---

## 10. General Security Notes on the Schema

- Every collection that stores a filesystem path (`Evidence.storagePath`, `RecoveredFile.storagePath`, `Report.filePath`) stores a **server-generated relative path**, never a client-provided one, to eliminate path traversal risk.
- `RecoveredFile.filename` is the clearest injection risk in this schema: it comes from *inside* forensic evidence (i.e., effectively untrusted, attacker-influenced data), so it is sanitized/escaped on the way in and never used directly to construct a storage path — only `storagePath` (server-generated from `recoveredFileId`) is used for that.
- No collection stores plaintext passwords, API keys, or the Python service's shared secret — those live in `.env` only (see 04-PYTHON-INTEGRATION.md, Section on authentication).
