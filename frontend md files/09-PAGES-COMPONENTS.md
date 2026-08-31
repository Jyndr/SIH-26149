# 09 — Pages & Components

## 1. Purpose

Inventories every page and its key components, so the UI scope is defined before anyone starts building screens. Keeps the frontend matched 1:1 to what the backend actually exposes (per `03-API.md`) — no page should exist for an endpoint that doesn't exist, and no endpoint should be missing a corresponding UI action.

---

## 2. Page Inventory

### `LoginPage` (`/login`)
- `LoginForm` — email + password, calls `useAuth().login()`
- On success → redirect to `/cases`
- Link to `/register`

### `RegisterPage` (`/register`)
- `RegisterForm` — name, email, password (+ confirm)
- On success → auto-login, redirect to `/cases`

### `CasesPage` (`/cases`)
- `CaseList` — paginated, filterable by `status`
- `CaseCard` — title, status badge, investigator count, "open" link
- `CaseForm` (in a `Modal`) — create new case
- Uses `useCases()`

### `CaseDetailPage` (`/cases/:caseId`)
- Tabbed layout: **Evidence | Jobs | Sanitization | Audit | Reports**
- Header: case title, `CaseStatusBadge`, investigator list, edit action (`CaseForm` reused in edit mode)
- **Evidence tab:** `EvidenceUploadForm` (drag-drop + progress bar via `useEvidenceUpload`), `EvidenceList` → `EvidenceCard` (filename, size, SHA-256 truncated + copy button, `IntegrityBadge`, analysis status), links to `EvidenceDetailPage`
- **Jobs tab:** list of all jobs for this case (analysis/recovery/carving), `JobStatusBadge`, links to `JobPage`
- **Sanitization tab:** links to `SanitizationPage`
- **Audit tab:** links to `AuditPage`
- **Reports tab:** links to `ReportsPage`
- Uses `useCase(caseId)`, `useEvidence(caseId)`, `useJobsForCase(caseId)`

### `EvidenceDetailPage` (`/cases/:caseId/evidence/:evidenceId`)
- Evidence metadata card (all fields from `02-DATABASE.md`'s Evidence schema that are safe to display — never raw `storagePath`)
- Action buttons: **Analyze**, **Recover**, **Verify Integrity** — each triggers the corresponding endpoint and navigates to `JobPage` for Analyze/Recover, or shows an inline result for Verify
- `RecoveredFileList` (once recovery has run) → `RecoveredFileCard` (filename, type, size, confidence score with a visual bar, recovery method, status)
- Uses `useEvidence(evidenceId)`, `useRecoveryResults(evidenceId)`

### `JobPage` (`/cases/:caseId/jobs/:jobId`)
- `JobProgressPanel` — live progress bar + current stage, driven by `useJobEvents(jobId)` (SSE)
- On `completed` → renders a result summary appropriate to `job.type` (analysis summary stats, or hands off to `RecoveredFileList` for recovery jobs)
- On `failed` → error card with `error.code`/`error.message`, and a "try again" action that re-triggers the same operation
- Falls back to polling `useJob(jobId)` if SSE fails to connect (progressive enhancement, not a hard requirement for v1)

### `SanitizationPage` (`/cases/:caseId/sanitize`)
- `SanitizeForm` — target type selector (File/Folder/Drive), target path/device input, method + standard dropdowns
- Because sanitization is destructive, the submit button requires an explicit confirmation step (`Modal` with a typed confirmation, e.g. "type DELETE to confirm") before calling the API
- `SanitizationJobList` — past sanitization jobs for the case with `verification` status
- Uses `useSanitization(caseId)`

### `AuditPage` (`/cases/:caseId/audit`)
- `AuditTimeline` — chronological list of audit entries (operation, actor, result, timestamp)
- `AuditVerifyBadge` — triggers `GET /audit/:auditId/verify` and shows a clear "chain intact" / "tamper detected at ..." result
- Uses `useAudit(caseId)`

### `ReportsPage` (`/cases/:caseId/reports`)
- `ReportGenerateButton` — dropdown of report `type`, triggers generation, navigates to `JobPage` while it's running (reports are async per `03-API.md`)
- `ReportList` → each row has a download link (`GET /reports/:reportId/download`) and displayed `hash` for integrity reference
- Uses `useReports(caseId)`

### `NotFoundPage` (`*`)
- Simple 404 with a link back to `/cases`

---

## 3. Shared Layout Components (`components/layout/`)

- **`AppShell`** — sidebar + topbar + content outlet, wraps every protected route
- **`Sidebar`** — nav links (Cases, and case-scoped tabs when inside a case)
- **`Topbar`** — current user name/role, logout action
- **`ProtectedRoute`** — reads `authStore.isAuthenticated`, redirects to `/login` if false

---

## 4. Shared UI Components (`components/ui/`)

| Component | Used for |
|---|---|
| `Button` | primary/secondary/danger variants (danger for sanitization actions) |
| `Card` | consistent bordered container used across nearly every page |
| `Modal` | case create/edit, sanitization confirmation |
| `Table` | evidence lists, audit timeline, report list |
| `Badge` | `CaseStatusBadge`, `JobStatusBadge`, `IntegrityBadge` all built on top of this |
| `ProgressBar` | job progress, upload progress, recovery confidence score |
| `Toast` | rendered globally from `uiStore.toasts` |
| `FormField` | label + input + inline validation error, used by every form |
| `Spinner` | loading states inside buttons/panels |

---

## 5. UI/UX Notes

- **Every destructive action (sanitization) uses `Button` variant="danger"** and requires the confirmation modal — no destructive action is a single click.
- **Confidence scores and status badges use color + text label together**, never color alone (e.g. `RECOVERED` green, `PARTIAL` amber, `CORRUPTED` red, each with the text visible, not just a colored dot) — accessible and also clearer in a live demo.
- **SHA-256 hashes are truncated with a copy-to-clipboard button** everywhere they're displayed (Evidence, RecoveredFile, Report) rather than shown in full, which would clutter every card.
- **Empty states matter for a demo:** every list component (`CaseList`, `EvidenceList`, `RecoveredFileList`, `AuditTimeline`, `ReportList`) has a designed empty state ("No evidence uploaded yet — upload your first file to get started") rather than a blank area, since judges will likely see these on a fresh demo case.
- **Loading states use `Spinner` inline within the relevant panel**, not a full-page blocking overlay, except for `uiStore.globalLoading` which is reserved for genuinely app-wide operations (e.g. initial auth hydration on app boot).

---

## 6. Mapping to Backend API (sanity check)

Every page/action above maps to a documented endpoint in `03-API.md`:

```text
LoginPage         → POST /auth/login
RegisterPage       → POST /auth/register
CasesPage          → GET/POST /cases
CaseDetailPage      → GET/PATCH /cases/:caseId, GET .../evidence, GET .../audit, GET .../reports
EvidenceDetailPage  → POST .../analyze, POST .../recover, POST .../verify, GET .../recovery-results
JobPage             → GET /jobs/:jobId, GET /jobs/:jobId/events
SanitizationPage    → POST /sanitize/*, GET /sanitize/jobs/:jobId
AuditPage           → GET .../audit, GET /audit/:auditId/verify
ReportsPage         → POST/GET .../reports, GET /reports/:reportId/download
```

No page requires an endpoint that isn't documented, and no documented endpoint lacks a page/action that uses it — keeping the two docs in sync is a five-minute check whenever either side changes.
