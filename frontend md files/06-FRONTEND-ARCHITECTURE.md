# 01 — Frontend Architecture

## 1. Purpose

Defines the architecture of the React frontend for the Integrated Secure Data Erasure and Advanced File Recovery Tool (SIH Problem Statement 26149). This mirrors the backend's `01-ARCHITECTURE.md` in spirit: keep it minimal, modular, and readable by a student team, and make it obvious where new code belongs.

The frontend's job is to let an investigator manage cases, upload evidence, trigger analysis/recovery/sanitization jobs, watch their progress live, review results, and generate reports — all against the REST + SSE API documented in the backend's `03-API.md`. It contains no forensic logic of its own.

---

## 2. Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | React (Vite) | fast dev server, minimal config, no framework lock-in like Next.js's SSR (not needed — this is an authenticated internal tool, not a public site) |
| Language | JavaScript | matches the backend's "JavaScript only" rule, one language across the whole team |
| Styling | Tailwind CSS | utility classes keep styling co-located with markup, no separate CSS-file sprawl across ~15–20 components |
| State management | Zustand | a handful of small, plain stores instead of Redux's boilerplate or prop-drilling through Context; fits a hackathon timeline |
| Routing | React Router | standard, well understood, sufficient for this app's page count |
| HTTP client | Axios | interceptors make JWT-attachment and centralized error handling trivial (see `03-API-INTEGRATION.md`) |
| Realtime | native `EventSource` (SSE) | matches the backend's SSE job-events endpoint; no socket.io needed since updates are one-directional (server → client) |
| Forms/validation | native controlled inputs + a small shared `validate.js` per form | avoids pulling in a form library for a form count this small |
| Testing | Vitest + React Testing Library | consistent with backend's Vitest choice, fast, no separate test runner to learn |

Explicitly **not** used: Redux, Next.js, React Query/SWR (data-fetching handled by simple hooks + Zustand, see Section 5), CSS-in-JS, GraphQL, TypeScript. Same "don't over-engineer a hackathon prototype" rule as the backend.

---

## 3. High-Level Architecture

```text
Browser
  ↓
React App (Vite build)
  ↓
Axios API client  ──────┐
  ↓                     ↓
Node/Express API    EventSource (SSE)
  ↓                     ↓
MongoDB / Python    Job progress stream
```

Inside the React app:

```text
Page (route-level component)
  ↓
Feature components
  ↓
Shared UI components (buttons, inputs, cards, tables)
  ↓
Hooks (useCases, useEvidence, useJob, ...)
  ↓
API client (services/api/*) + Zustand stores
```

Pages own layout and composition. Feature components own a specific chunk of UI logic (an evidence upload form, a job progress panel). Shared UI components are dumb and reusable. Hooks are the glue that connects components to data (API calls + store state) without components calling `axios` or touching a Zustand store directly.

---

## 4. Responsibilities by Layer

### Pages (`src/pages/`)
One file per route (`CasesPage.jsx`, `CaseDetailPage.jsx`, `EvidenceDetailPage.jsx`, etc.). A page composes feature components and handles route params (`useParams`) — it does not contain business logic or direct API calls.

### Feature components (`src/features/<feature>/components/`)
Grouped by domain (`cases`, `evidence`, `jobs`, `sanitization`, `audit`, `reports`, `auth`). Each feature folder owns the components, hooks, and (if needed) small local state specific to that domain. This keeps a student working on "evidence upload" from needing to understand "audit log verification" internals.

### Shared UI components (`src/components/ui/`)
Presentational, reusable, no API/store knowledge: `Button`, `Card`, `Table`, `Modal`, `Badge`, `ProgressBar`, `Toast`, `FormField`. Styled with Tailwind. These are the only components allowed to have zero business meaning.

### Hooks (`src/features/<feature>/hooks/` and `src/hooks/`)
Custom hooks are the **only** place components call the API client or read/write a Zustand store's actions. E.g. `useCases()` wraps `casesApi` + `useCaseStore`, exposing `{ cases, loading, error, createCase, refetch }` to components. This mirrors the backend's "controllers only call services" rule — here, "components only call hooks."

### API client (`src/services/api/`)
Thin Axios wrappers, one file per backend resource (`auth.api.js`, `cases.api.js`, `evidence.api.js`, `jobs.api.js`, `sanitization.api.js`, `audit.api.js`, `reports.api.js`), matching the backend's `03-API.md` endpoint-for-endpoint. No React, no Zustand — pure request/response functions. See `03-API-INTEGRATION.md`.

### Stores (`src/store/`)
Zustand stores hold global/cross-page state: `authStore` (current user, token), `caseStore` (currently active case), `uiStore` (toasts, global loading/modals). Data that's naturally scoped to one page (e.g. "is this modal open") stays as local `useState`, not global store state. See `02-STATE-MANAGEMENT.md`.

### Utils (`src/utils/`)
Pure helper functions: date formatting, byte-size formatting, file-type icons, form validators, the SSE connection helper.

### Config (`src/config/`)
`env.js` (reads `VITE_API_BASE_URL` etc.), route constants, job-type/status enums mirrored from the backend so the frontend and backend never drift on allowed values.

---

## 5. Recommended Folder Structure

```text
client/
├── src/
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── RegisterPage.jsx
│   │   ├── CasesPage.jsx
│   │   ├── CaseDetailPage.jsx
│   │   ├── EvidenceDetailPage.jsx
│   │   ├── JobPage.jsx
│   │   ├── SanitizationPage.jsx
│   │   ├── AuditPage.jsx
│   │   ├── ReportsPage.jsx
│   │   └── NotFoundPage.jsx
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/  (LoginForm, RegisterForm)
│   │   │   └── hooks/       (useAuth)
│   │   ├── cases/
│   │   │   ├── components/  (CaseList, CaseCard, CaseForm, CaseStatusBadge)
│   │   │   └── hooks/       (useCases, useCase)
│   │   ├── evidence/
│   │   │   ├── components/  (EvidenceUploadForm, EvidenceList, EvidenceCard, IntegrityBadge)
│   │   │   └── hooks/       (useEvidence, useEvidenceUpload)
│   │   ├── jobs/
│   │   │   ├── components/  (JobProgressPanel, JobStatusBadge, RecoveredFileList, RecoveredFileCard)
│   │   │   └── hooks/       (useJob, useJobEvents)
│   │   ├── sanitization/
│   │   │   ├── components/  (SanitizeForm, SanitizationJobList)
│   │   │   └── hooks/       (useSanitization)
│   │   ├── audit/
│   │   │   ├── components/  (AuditTimeline, AuditVerifyBadge)
│   │   │   └── hooks/       (useAudit)
│   │   └── reports/
│   │       ├── components/  (ReportList, ReportGenerateButton)
│   │       └── hooks/       (useReports)
│   │
│   ├── components/
│   │   ├── ui/               (Button, Card, Modal, Table, Badge, ProgressBar, Toast, FormField, Spinner)
│   │   └── layout/            (AppShell, Sidebar, Topbar, ProtectedRoute)
│   │
│   ├── services/
│   │   └── api/
│   │       ├── axiosClient.js
│   │       ├── auth.api.js
│   │       ├── cases.api.js
│   │       ├── evidence.api.js
│   │       ├── jobs.api.js
│   │       ├── sanitization.api.js
│   │       ├── audit.api.js
│   │       └── reports.api.js
│   │
│   ├── store/
│   │   ├── authStore.js
│   │   ├── caseStore.js
│   │   └── uiStore.js
│   │
│   ├── hooks/
│   │   └── useSSE.js
│   │
│   ├── utils/
│   │   ├── format.js
│   │   ├── validate.js
│   │   └── constants.js
│   │
│   ├── config/
│   │   └── env.js
│   │
│   ├── router.jsx
│   ├── App.jsx
│   └── main.jsx
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── docs/
├── .env.example
└── package.json
```

**Why feature-first, not type-first:** grouping by `features/cases/`, `features/evidence/`, etc. (rather than one giant `components/` folder with 40 files) keeps each domain self-contained and lets multiple students work on different features without touching the same folder. `components/ui/` stays type-first because those pieces are genuinely shared and domain-agnostic.

---

## 6. Routing

```text
/login                                    (public)
/register                                 (public)
/cases                                    (protected) — case list
/cases/:caseId                            (protected) — case detail: evidence list, jobs, audit, reports tabs
/cases/:caseId/evidence/:evidenceId       (protected) — evidence detail, analyze/recover triggers, recovered files
/cases/:caseId/jobs/:jobId                (protected) — live job progress (SSE) + result
/cases/:caseId/sanitize                   (protected) — sanitization request + job list
/cases/:caseId/audit                      (protected) — audit timeline + chain verify
/cases/:caseId/reports                    (protected) — report list + generate
*                                         → NotFoundPage
```

`ProtectedRoute` (in `components/layout/`) wraps every protected route, reading `authStore` and redirecting to `/login` if there's no valid token — this is the frontend's single authorization gate, mirroring the backend's `auth.middleware.js`.

---

## 7. Architectural Rules (non-negotiable)

1. **Components never call Axios or a store's setter directly for server data.** Always through a hook.
2. **`services/api/` files have no React or Zustand imports.** They are plain functions, easily unit-tested and easily reused outside components.
3. **One feature folder per backend domain**, matching the backend's resource split (cases, evidence, jobs, sanitization, audit, reports) — this keeps the mental model identical across both codebases.
4. **`components/ui/` stays dumb.** No `useEffect` fetching data, no store reads — props in, JSX out.
5. **SSE connections are opened and closed inside a hook (`useJobEvents`)**, never directly inside a page component, so cleanup-on-unmount is never forgotten.
6. **No global store for data that's only ever used on one page.** If only `CaseDetailPage` needs it, it's `useState` there, not a Zustand store.
