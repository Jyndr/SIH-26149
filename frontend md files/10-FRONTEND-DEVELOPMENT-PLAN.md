# 10 — Frontend Development Plan

## How to use this document

Same approach as the backend's `05-DEVELOPMENT-PLAN.md`: work phases in order, each ends in something demoable. **Phase 3 (mock API layer) is the frontend's equivalent of the backend's mock-Python phase** — it means frontend work is never blocked waiting for a real backend endpoint to exist.

---

## Phase 1 — Project Setup

- [ ] `npm create vite@latest` (React template), install Tailwind, configure `tailwind.config.js` / `postcss.config.js`
- [ ] Install core deps: `react-router-dom`, `zustand`, `axios`
- [ ] `src/config/env.js`, `.env.example` with `VITE_API_BASE_URL`
- [ ] `src/router.jsx` with all routes from `06-FRONTEND-ARCHITECTURE.md` Section 6, pointing to placeholder page components
- [ ] `AppShell`, `Sidebar`, `Topbar`, `ProtectedRoute` (auth check can be stubbed until Phase 2)
- [ ] Base Tailwind design tokens: color palette (including status colors — success/warning/danger), spacing, typography scale, applied consistently via `components/ui/`
- [ ] `components/ui/` skeleton: `Button`, `Card`, `Badge`, `Spinner`, `Toast`, `FormField`
- **Done when:** `npm run dev` shows the shell with working navigation between empty placeholder pages, styled with the base Tailwind tokens.

---

## Phase 2 — Auth Flow

- [ ] `authStore.js`
- [ ] `services/api/axiosClient.js` + `auth.api.js`
- [ ] `features/auth/hooks/useAuth.js`
- [ ] `LoginForm`, `RegisterForm`, wired into `LoginPage`/`RegisterPage`
- [ ] `ProtectedRoute` now reads real `authStore.isAuthenticated`
- [ ] Token hydration on app boot (`authStore.hydrate()` called once in `App.jsx`)
- **Done when:** register → login → land on `/cases` (even if `/cases` is still a placeholder) works against the real backend, and refreshing the page keeps the user logged in via persisted token, and an expired/invalid token correctly redirects to `/login`.

---

## Phase 3 — Mock API Layer (parallel-unblocking phase)

Build a tiny local mock (e.g. a `msw` setup, or a flag-toggled set of functions in each `*.api.js` returning fixture data with a fake delay) covering endpoints the backend hasn't finished yet.

- [ ] Fixture data matching every schema in the backend's `02-DATABASE.md` (a sample Case, a few Evidence records, a completed Job with `RecoveredFile`s, a `SanitizationJob`, some `AuditLog` entries, a `Report`)
- [ ] Each `*.api.js` function can run against either the real backend or fixtures via an env flag (`VITE_USE_MOCKS=true`)
- **Done when:** every page in Phase 4–9 below can be built and demoed end-to-end using fixtures alone, without the real backend running — this is what protects frontend velocity if backend/Python integration slips.

---

## Phase 4 — Case Management UI

- [ ] `cases.api.js`, `caseStore.js`, `useCases`, `useCase`
- [ ] `CaseList`, `CaseCard`, `CaseForm`, `CaseStatusBadge`
- [ ] `CasesPage` fully wired; `CaseDetailPage` header + tab shell (tabs can be empty placeholders still)
- **Done when:** a user can create a case, see it in the list, open it, and edit its title/description/status.

---

## Phase 5 — Evidence UI

- [ ] `evidence.api.js` (including multipart upload with progress)
- [ ] `useEvidence`, `useEvidenceUpload`
- [ ] `EvidenceUploadForm` (drag-drop + progress bar), `EvidenceList`, `EvidenceCard`, `IntegrityBadge`
- [ ] `EvidenceDetailPage` shell with metadata card + Analyze/Recover/Verify buttons (can call mocked endpoints from Phase 3 until Phase 6 backend catches up)
- **Done when:** a file can be uploaded with a visible progress bar, appears in the evidence list with a correct SHA-256 display, and "Verify Integrity" shows a pass/fail result.

---

## Phase 6 — Jobs UI + SSE

- [ ] `jobs.api.js`, `useSSE`, `useJobEvents`, `useJob` (polling fallback)
- [ ] `JobProgressPanel`, `JobStatusBadge`
- [ ] `JobPage` fully wired: live progress → completed/failed result rendering
- [ ] `RecoveredFileList`, `RecoveredFileCard` wired into both `JobPage` (recovery jobs) and `EvidenceDetailPage`
- **Done when:** triggering Analyze or Recover from `EvidenceDetailPage` navigates to `JobPage` and shows live progress updates via SSE (against mocks or real backend), ending in either a result summary or a clear failure state.

---

## Phase 7 — Sanitization UI

- [ ] `sanitization.api.js`, `useSanitization`
- [ ] `SanitizeForm` with target-type-dependent fields, confirmation `Modal`
- [ ] `SanitizationJobList`
- [ ] `SanitizationPage` fully wired
- **Done when:** a sanitization request requires explicit confirmation before submitting, and past sanitization jobs display their verification status.

---

## Phase 8 — Audit UI

- [ ] `audit.api.js`, `useAudit`
- [ ] `AuditTimeline`, `AuditVerifyBadge`
- [ ] `AuditPage` fully wired
- **Done when:** the audit timeline for a case renders in order, and the verify action clearly shows "chain intact" or exactly where tampering was detected (test this against a deliberately corrupted fixture/entry).

---

## Phase 9 — Reports UI

- [ ] `reports.api.js`, `useReports`
- [ ] `ReportGenerateButton`, `ReportList`
- [ ] `ReportsPage` fully wired, including file download
- **Done when:** a report can be generated (shows job progress via the same `JobPage` flow from Phase 6), appears in the list once complete, and downloads correctly with its hash visible.

---

## Phase 10 — Polish, Empty States, Error States

- [ ] Empty-state design applied to every list component (per `09-PAGES-COMPONENTS.md` Section 5)
- [ ] Loading states (`Spinner`) applied consistently, no layout jump when data arrives
- [ ] Toast styling finalized (success/error/info variants)
- [ ] Responsive check at common breakpoints (this is an internal tool, but a laptop-vs-slightly-smaller-laptop check matters for a demo projector)
- [ ] Full click-through of the demo script from the backend's Phase 12 (register→login→case→upload→analyze→recover→sanitize→audit-verify→report) against the real backend end-to-end
- **Done when:** the full demo script runs cleanly against the real backend with no visible loading flashes, broken empty states, or unstyled error dumps.

---

## Phase 11 — Testing

- [ ] Vitest + React Testing Library setup
- [ ] Unit tests for hooks (`useCases`, `useEvidenceUpload`, `useJobEvents` with a mocked `EventSource`)
- [ ] Component tests for critical interactive components (`SanitizeForm` confirmation flow, `EvidenceUploadForm` progress, `LoginForm` validation)
- [ ] At least one integration-style test per page rendering with mocked API responses
- **Done when:** `npm test` passes clean and the sanitization confirmation flow specifically has a test proving it can't be bypassed with a single click.

---

## Recommended Overall Order

Phases 1 → 11 as written. **Do not start Phase 4 before Phase 3's mock layer exists** — that's the mirror of the backend plan's "don't start Phase 7 before the mock Python service," and for the same reason: it's what lets frontend and backend development happen in parallel instead of sequentially, which matters most in a fixed hackathon timeline.
