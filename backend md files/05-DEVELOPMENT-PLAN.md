# 05 — Development Plan

## How to use this document

Work through the phases in order. Each phase ends in something demoable or testable — don't move to the next phase with a broken previous one. Phase 6 (mock Python service) is the single most important sequencing decision: it unblocks the entire rest of the Node backend from ever waiting on the Python team's real implementation.

---

## Phase 1 — Project Setup

Build: Express app skeleton, MongoDB connection, environment config, global error handling, logging, health endpoint.

- [ ] `npm init`, install core deps (express, mongoose, dotenv, cors, helmet, morgan or pino)
- [ ] `src/config/env.js` — load and validate `.env`, fail fast on missing required vars
- [ ] `src/config/db.js` — Mongoose connection with sensible retry/backoff on startup
- [ ] `src/app.js` — Express app with helmet, cors, JSON body parsing, request logging, request-ID middleware
- [ ] `src/server.js` — imports `app.js`, connects DB, starts listening
- [ ] `src/middleware/error.middleware.js` — single error handler producing the standard error envelope
- [ ] `src/utils/ApiError.js`, `src/utils/ApiResponse.js`, `src/utils/asyncHandler.js`
- [ ] `GET /api/v1/health` returning app + DB status
- [ ] `.env.example` committed with every variable named (no real values)
- **Done when:** `npm run dev` starts the server, `/health` returns 200, a thrown error anywhere returns the standard error shape instead of crashing the process.

---

## Phase 2 — Case Management

Build: `Case` model, service, controller, routes.

- [ ] `src/models/Case.js`
- [ ] `src/validators/case.validators.js` (Zod)
- [ ] `src/services/case.service.js` — create, list (scoped to user), getById, update
- [ ] `src/controllers/case.controller.js`
- [ ] `src/routes/case.routes.js`
- [ ] Unit tests for `case.service.js`
- **Done when:** all four `/cases` endpoints work end-to-end against a real test DB via Supertest, without auth yet (auth comes next phase — build this on a temporary "fake user" middleware if needed, then swap it out in Phase 3).

---

## Phase 3 — Authentication + Authorization

Build: `User` model, JWT issuing/verification, bcrypt hashing, role/ownership checks.

- [ ] `src/models/User.js`
- [ ] `src/services/auth.service.js` — register (hash password), login (verify + issue JWT), `me`
- [ ] `src/middleware/auth.middleware.js` — verify JWT, attach `req.user`
- [ ] `src/middleware/authorize.middleware.js` — case-ownership check, reusable across all resource routes
- [ ] Wire `auth.middleware.js` into all previously "temporarily open" routes from Phase 2
- [ ] `case.service.js` updated to scope `createdBy`/`investigators` from `req.user`
- [ ] Integration tests: register → login → create case → get case (403 for a different user)
- **Done when:** every route from Phase 2 requires a valid JWT and correctly enforces case ownership.

---

## Phase 4 — Evidence Upload

Build: streaming upload, local storage, SHA-256, MongoDB metadata, integrity verification.

- [ ] `src/services/storage/storage.service.js` — resolve storage paths under `storage/evidence/`, write streams
- [ ] `src/services/hash/hash.service.js` — streaming SHA-256 (hash computed in the same pass as the disk write, not after)
- [ ] Multer (disk storage engine) or a raw streaming approach, wired so large files never fully buffer in memory
- [ ] `src/models/Evidence.js`
- [ ] `src/services/evidence.service.js` — upload, list, getById, verify integrity
- [ ] `src/controllers/evidence.controller.js`, `src/routes/evidence.routes.js`
- [ ] MIME-type detection server-side (not trusting the client `Content-Type`)
- [ ] Duplicate detection via compound unique index `(caseId, sha256)`
- **Done when:** a file can be uploaded via `POST /cases/:caseId/evidence`, its SHA-256 matches an independently computed hash of the stored file, and `POST /evidence/:id/verify` correctly detects if the stored file is later modified.

---

## Phase 5 — Generic Job System

Build: the `Job` model and its state machine, shared by every async operation.

- [ ] `src/models/Job.js`
- [ ] `src/services/job.service.js` — create, transition status, record progress, get by id
- [ ] `src/controllers/job.controller.js`, `src/routes/job.routes.js` — `GET /jobs/:jobId`
- [ ] SSE endpoint `GET /jobs/:jobId/events` — in-process event emitter is enough at this scale (no Redis pub/sub needed for a single-instance hackathon deployment)
- [ ] Unit tests for job state transitions (QUEUED → RUNNING → COMPLETED/FAILED)
- **Done when:** a Job can be created and manually driven through its states in a test, and an SSE client watching `/jobs/:jobId/events` sees progress/completed events pushed in real time.

---

## Phase 6 — Mock Python Service

Build: a small, separate Express app (or even a few Express routes in a throwaway script) that fakes the Python contract from `04-PYTHON-INTEGRATION.md` — accepts requests, waits a few seconds, returns realistic fake results.

- [ ] Minimal mock server implementing `/internal/health`, `/internal/v1/analyze`, `/internal/v1/recover`, `/internal/v1/sanitize`, `/internal/v1/verify`, `/internal/v1/jobs/:id`
- [ ] Returns the exact JSON shapes documented in `04-PYTHON-INTEGRATION.md`, with artificial delay + fake progress
- [ ] `src/services/python/pythonClient.js` built against this mock, including timeout/retry/error-mapping logic
- **Done when:** the mock can simulate success, failure, and timeout, and `pythonClient.js` handles all three correctly. **This phase exists so Phases 7–8 (and the whole frontend) can be built and demoed without ever waiting on the real Python service** — swapping the mock for the real one later should mean changing `PYTHON_SERVICE_URL` in `.env`, nothing else.

---

## Phase 7 — Recovery Integration

Build: the real `analyze` and `recover` flows against the mock (then later the real) Python service.

- [ ] `src/services/python/analyze.js`, `src/services/python/recover.js` wrapping `pythonClient`
- [ ] `src/services/recovery.service.js` — orchestrates: create Job → call Python → on result, validate + write `RecoveredFile` docs → update Evidence.analysisStatus/filesystem
- [ ] `src/models/RecoveredFile.js`
- [ ] `src/controllers/analysis.controller.js`, `src/controllers/recovery.controller.js` + routes
- [ ] Result-shape Zod validation before any DB write
- **Done when:** `POST /evidence/:id/recover` against the mock produces real `RecoveredFile` documents visible via `GET /evidence/:id/recovery-results`, and SSE shows live progress.

---

## Phase 8 — Sanitization Integration

Build: sanitization request/verification flow — the most destructive, so extra care on authorization here.

- [ ] `src/models/SanitizationJob.js`
- [ ] `src/services/python/sanitize.js`, `src/services/python/verify.js`
- [ ] `src/services/sanitization.service.js`
- [ ] `src/controllers/sanitization.controller.js` + routes (`/sanitize/file`, `/sanitize/folder`, `/sanitize/drive`, `/sanitize/jobs/:jobId`)
- [ ] Extra authorization check decided in `03-API.md` Section 8 (e.g. require `ADMIN` or explicit permission)
- **Done when:** a sanitization request against the mock produces a `SanitizationJob` with a `verification` result, and an unauthorized user is correctly blocked.

---

## Phase 9 — Audit + Tamper-Evident Hash Chain

Build: append-only audit logging wired into every prior service.

- [ ] `src/models/AuditLog.js`
- [ ] `src/services/audit/audit.service.js` — `record(entry)` computes `recordHash` from `previousHash` + entry content
- [ ] Call `audit.service.js` from every mutating action in every service built so far (case create/update, evidence upload, job start/complete, sanitization, verification) — go back and retrofit prior phases
- [ ] `src/controllers/audit.controller.js` + routes, including `/audit/:auditId/verify` (walk the chain and confirm no break)
- [ ] Tests: tamper with a raw AuditLog document directly in the test DB, confirm `/verify` detects the break
- **Done when:** every major action in the system produces an audit entry, and deliberately corrupting one entry is detected by the verify endpoint.

---

## Phase 10 — Reports

Build: report generation as its own Job type, pulling together case + evidence + job + audit data.

- [ ] `src/models/Report.js`
- [ ] `src/services/report.service.js` — assembles report content (can start as a simple templated PDF or even structured JSON/HTML if PDF generation is out of scope for time)
- [ ] `src/controllers/report.controller.js` + routes, including authenticated download
- [ ] Report file hash stored on creation
- **Done when:** a report can be generated for a case and downloaded, and its stored hash matches an independent hash of the downloaded file.

---

## Phase 11 — Security Hardening

Go back across everything built so far with a security pass.

- [ ] Re-check every model's "not trusted from client" list from `02-DATABASE.md` is actually enforced in validators/services
- [ ] Rate limiting on auth endpoints
- [ ] Helmet config reviewed (CSP, etc. as appropriate for an API-only backend)
- [ ] File upload limits (max size, allowed types) enforced server-side
- [ ] Path traversal review on every place a filename/path touches the filesystem
- [ ] Ensure recovered files are never executed, served with an executable content-type, or served inline (always `Content-Disposition: attachment` + generic content-type where appropriate)
- [ ] Secrets audit — confirm nothing in Section 7 of `01-ARCHITECTURE.md`'s `.env.example` pattern is hardcoded anywhere
- **Done when:** the checklist above is fully checked off and reviewed by a second team member.

---

## Phase 12 — Testing

Consolidate and fill gaps rather than starting from scratch — tests should already exist per-phase above.

- [ ] Unit test coverage for every service (Jest/Vitest)
- [ ] Integration tests (Supertest) for every route, including auth failure and authorization failure cases
- [ ] At least one full end-to-end integration test per major flow: register→login→case→upload→analyze→recover→sanitize→audit-verify→report
- [ ] Test the mock-Python failure modes (timeout, malformed response) actually produce `FAILED` jobs correctly
- **Done when:** `npm test` passes clean, and the end-to-end flow test demonstrates the whole system working together — this is also your demo script.

---

## Recommended Overall Order

Phases 1 → 12 in the order written above. The one hard rule: **do not start Phase 7 until Phase 6's mock is working** — that's what lets the Node team keep moving at full speed regardless of the Python team's progress, and it's the biggest schedule-risk mitigation available in this plan.
