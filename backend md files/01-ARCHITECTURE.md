# 01 — Architecture

## 1. Purpose

This document defines the architecture of the Node.js/Express backend for the Integrated Secure Data Erasure and Advanced File Recovery Tool (SIH Problem Statement 26149). It exists so that every team member — including anyone joining midway — can understand where a piece of logic belongs without asking.

The backend's job is **orchestration, not forensics**. It owns cases, evidence metadata, users, jobs, audit trails, and reports. It never touches raw disk images at the byte level and never implements carving, filesystem parsing, or sanitization algorithms — that is the Python service's job.

---

## 2. High-Level Architecture

```text
React Frontend
      ↓ (REST + SSE)
Node.js + Express Backend
      ↓
 ┌────┴─────┐
 ↓          ↓
MongoDB   Python Forensic Service
              ↓
        Forensic Tools
```

Inside the Node backend, requests flow through a single, consistent pipeline:

```text
Route
  ↓
Middleware (auth, validation)
  ↓
Controller
  ↓
Service
  ↓
Model (MongoDB) / Python Client (external service)
```

And for anything forensic:

```text
Node (recoveryService / sanitizationService / analysisService)
  ↓
pythonClient
  ↓
Python Service (HTTP)
  ↓
Forensic Engine
```

This is a **modular monolith**: one Express app, cleanly separated by responsibility, talking to one external service (Python) over HTTP. No microservices, no message broker, no orchestration platform. For a hackathon prototype this is the correct level of complexity — anything more adds operational risk without adding capability the judges will see.

---

## 3. Responsibilities by Layer

### Routes (`src/routes/`)
Declare URL paths, HTTP methods, and which middleware + controller handle them. **No logic.** A route file should be readable top-to-bottom as a table of contents for that resource's API.

### Middleware (`src/middleware/`)
Cross-cutting concerns that run before/after controllers:
- `auth.middleware.js` — verifies JWT, attaches `req.user`
- `authorize.middleware.js` — role/ownership checks (e.g. is this user an investigator on this case?)
- `validate.middleware.js` — runs a Zod schema against `req.body`/`params`/`query`, rejects early with a 400
- `error.middleware.js` — the single place that turns thrown errors into the standard error response shape
- `requestId.middleware.js` — attaches a correlation ID to every request for tracing into audit logs and Python calls

### Controllers (`src/controllers/`)
Thin adapters between HTTP and the domain. A controller:
1. Reads `req.body/params/query/user`
2. Calls exactly one service method
3. Shapes the result into `{ success, data }`
4. Passes errors to `next(error)`

A controller must never talk to Mongoose models or the Python client directly.

### Services (`src/services/`)
Where the actual business logic lives — case rules, evidence ownership checks, job lifecycle transitions, hash verification, orchestration of Python calls. Services are the only layer allowed to import Models and the `pythonClient`.

Subfolders:
- `services/python/` — the `pythonClient` abstraction (see 04-PYTHON-INTEGRATION.md) plus per-operation wrappers (`analyze.js`, `recover.js`, `sanitize.js`, `verify.js`)
- `services/storage/` — local filesystem storage: writing uploaded evidence to disk, generating storage paths, streaming reads, deleting temp files
- `services/hash/` — SHA-256 computation (streaming, so large evidence files don't get loaded into memory)
- `services/audit/` — append-only audit log writer + hash-chain verification
- One service per domain resource otherwise: `case.service.js`, `evidence.service.js`, `job.service.js`, `report.service.js`, `auth.service.js`

### Models (`src/models/`)
Mongoose schemas only. No business logic beyond simple schema-level validation/defaults and instance methods that are pure data transforms (e.g. `toSafeJSON()` to strip internal fields).

### Validators (`src/validators/`)
Zod schemas per resource/action (`evidence.validators.js`, `case.validators.js`, etc.), consumed by `validate.middleware.js`. Keeping these separate from controllers makes request/response contracts easy to review and test independently.

### Config (`src/config/`)
Environment loading and validation (fail fast if a required `.env` var is missing), DB connection setup, and any constants that shouldn't be scattered across the codebase (job types, sanitization standards, allowed MIME types).

### Utils (`src/utils/`)
Pure, stateless helper functions with no side effects — response formatters, async error wrapper, pagination helpers. If a "util" starts talking to the DB or an external service, it belongs in `services/` instead.

---

## 4. Recommended Folder Structure

```text
server/
├── src/
│   ├── config/
│   │   ├── env.js
│   │   ├── db.js
│   │   └── constants.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── case.controller.js
│   │   ├── evidence.controller.js
│   │   ├── analysis.controller.js
│   │   ├── recovery.controller.js
│   │   ├── job.controller.js
│   │   ├── sanitization.controller.js
│   │   ├── audit.controller.js
│   │   └── report.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── authorize.middleware.js
│   │   ├── validate.middleware.js
│   │   ├── error.middleware.js
│   │   └── requestId.middleware.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Case.js
│   │   ├── Evidence.js
│   │   ├── Job.js
│   │   ├── RecoveredFile.js
│   │   ├── SanitizationJob.js
│   │   ├── AuditLog.js
│   │   └── Report.js
│   ├── routes/
│   │   ├── index.js
│   │   ├── auth.routes.js
│   │   ├── case.routes.js
│   │   ├── evidence.routes.js
│   │   ├── job.routes.js
│   │   ├── sanitization.routes.js
│   │   ├── audit.routes.js
│   │   └── report.routes.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── case.service.js
│   │   ├── evidence.service.js
│   │   ├── job.service.js
│   │   ├── recovery.service.js
│   │   ├── sanitization.service.js
│   │   ├── report.service.js
│   │   ├── python/
│   │   │   ├── pythonClient.js
│   │   │   ├── analyze.js
│   │   │   ├── recover.js
│   │   │   ├── sanitize.js
│   │   │   └── verify.js
│   │   ├── storage/
│   │   │   └── storage.service.js
│   │   ├── hash/
│   │   │   └── hash.service.js
│   │   └── audit/
│   │       └── audit.service.js
│   ├── validators/
│   │   ├── auth.validators.js
│   │   ├── case.validators.js
│   │   ├── evidence.validators.js
│   │   └── sanitization.validators.js
│   ├── utils/
│   │   ├── asyncHandler.js
│   │   ├── ApiError.js
│   │   ├── ApiResponse.js
│   │   └── pagination.js
│   ├── app.js
│   └── server.js
│
├── storage/
│   ├── evidence/
│   ├── recovered/
│   ├── reports/
│   └── temp/
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── docs/
├── .env.example
└── package.json
```

**Why each top-level directory exists:**
- `src/` — all application code, so the project root stays clean
- `storage/` — local filesystem storage for evidence images, recovered files, and generated reports, kept outside `src/` so it's easy to `.gitignore`, back up, or later swap for S3-style storage without touching code structure
- `tests/` — mirrors `src/`, split into fast unit tests (services, utils) and slower integration tests (Supertest against a real test DB)
- `docs/` — this documentation set, kept alongside the code it describes

`app.js` builds and configures the Express app (middleware, routes) but does not call `.listen()` — this makes it importable by Supertest. `server.js` imports `app.js`, connects to MongoDB, and starts listening. This split is the single biggest thing that makes the backend testable without hacks.

---

## 5. Architectural Rules (non-negotiable)

1. **Controllers stay thin.** If a controller has an `if`, a loop, or a Mongoose query in it, that logic belongs in a service.
2. **No business logic in routes.** Routes only wire `method + path + middleware + controller`.
3. **No giant `server.js`.** Startup concerns (`server.js`) are separate from app configuration (`app.js`), which is separate from everything else.
4. **Only services touch Models and the Python client.** Controllers never `require()` a Mongoose model or `pythonClient` directly.
5. **One clear responsibility per file.** A file named `evidence.service.js` should not also contain hashing logic (that's `hash.service.js`) or storage path logic (that's `storage.service.js`).
6. **The Python client is the only door to Python.** No controller or route ever calls the Python service's HTTP API directly — always through `services/python/pythonClient.js` and its operation wrappers.

These rules exist so a student team of varying experience levels can work on different resources (cases vs. evidence vs. jobs) in parallel without merge conflicts or hidden coupling, and so the Python team only ever needs to look at `services/python/` to understand the integration contract.
