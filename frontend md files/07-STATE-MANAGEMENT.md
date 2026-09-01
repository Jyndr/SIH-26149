# 07 — State Management (Zustand)

## 1. Purpose

Defines every Zustand store in the frontend, what belongs in global state vs. local component state, and the conventions for keeping stores small and predictable as the student team builds out features in parallel.

**Guiding rule:** Zustand holds state that's genuinely shared across multiple, unrelated parts of the tree (who's logged in, which case is currently active, global toasts). Everything else — form inputs, "is this modal open," a single page's fetched list — stays as local `useState`/`useReducer` inside the component or feature hook that owns it. Reaching for a global store by default is how small apps end up with unmaintainable state; this document exists to stop that.

---

## 2. Store Inventory

### `authStore` (`src/store/authStore.js`)

Holds the authenticated user and JWT.

```js
{
  user: null,        // { userId, name, email, role } | null
  token: null,        // JWT string | null
  isAuthenticated: false,

  login(user, token),   // sets user, token, isAuthenticated=true, persists token
  logout(),             // clears everything, persists nothing
  hydrate(),             // called once on app boot, reads token from storage
}
```

- The JWT is persisted to `localStorage` (acceptable for a hackathon prototype; note this as a known trade-off, not something to silently forget — a production version would consider httpOnly cookies instead).
- `axiosClient.js` reads the token from this store via a request interceptor (see `03-API-INTEGRATION.md`) — no component ever manually attaches the `Authorization` header.
- `ProtectedRoute` reads `isAuthenticated` to decide whether to redirect to `/login`.

### `caseStore` (`src/store/caseStore.js`)

Holds the currently active case, since almost every page below `/cases/:caseId/*` needs it (breadcrumbs, authorization display, sidebar context) and re-fetching it on every nested route would be wasteful.

```js
{
  activeCase: null,        // full Case object | null
  setActiveCase(caseObj),
  clearActiveCase(),
}
```

- Set once when `CaseDetailPage` (or any nested route) loads the case via `useCase(caseId)`.
- Cleared on navigating away from `/cases/:caseId/*` (handled in a layout-level `useEffect`, not scattered across every page).
- The full list of cases (`/cases` page) is **not** stored here — it's local state inside `useCases()`, since it's only ever needed on `CasesPage`.

### `uiStore` (`src/store/uiStore.js`)

Holds cross-cutting UI state that any component might need to trigger.

```js
{
  toasts: [],                          // [{ id, type, message }]
  pushToast(type, message),
  dismissToast(id),

  globalLoading: false,                // rare: full-page loading overlay
  setGlobalLoading(bool),
}
```

- The Axios response interceptor calls `pushToast('error', ...)` on any unhandled API error, so error surfacing is centralized (see `03-API-INTEGRATION.md`) rather than every hook needing its own toast logic.

---

## 3. What Does NOT Go in a Store

- **Fetched lists/detail data for a single page** (case list, evidence list, recovered files, audit entries, reports) — these live in the feature hook that fetches them (`useCases`, `useEvidence`, etc.) as local `useState`, returned to the page. If two unrelated pages genuinely need the same fetched data simultaneously, that's the signal to promote it to a store — not before.
- **Form state** — controlled inputs stay local to the form component.
- **Job progress (SSE data)** — lives inside `useJobEvents`, scoped to whichever page is currently watching that job; there's no reason for job progress to be globally readable when only one page ever displays it at a time.
- **Modal open/closed, active tab, sort/filter selections** — local UI state, local `useState`.

---

## 4. Pattern: Store + Hook Together

Stores hold state and simple setters only — no API calls inside a store. API calls happen in the corresponding feature hook, which then calls the store's setter with the result. This mirrors the backend's "services own the data logic, models are just schemas" split:

```js
// features/cases/hooks/useCase.js
export function useCase(caseId) {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const setActiveCase = useCaseStore((s) => s.setActiveCase);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    casesApi.getById(caseId)
      .then((data) => {
        if (cancelled) return;
        setCaseData(data);
        setActiveCase(data);
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [caseId]);

  return { case: caseData, loading, error };
}
```

Components consume `useCase(caseId)` and never touch `caseStore` or `casesApi` directly — matching the architectural rule in `06-FRONTEND-ARCHITECTURE.md`.

---

## 5. Why Zustand Over Redux/Context Here

- **No boilerplate** — a store is a single `create()` call, no actions/reducers/dispatch ceremony, which matters for a small team on a hackathon timeline.
- **No provider wrapping needed** — unlike Context, components import the store hook directly; one less layer to wire into `App.jsx`.
- **Selective subscriptions** — components can select just the slice they need (`useAuthStore(s => s.user)`), avoiding the re-render-everything problem that plain Context has once state changes frequently (e.g. `uiStore.toasts` updating shouldn't re-render components only reading `authStore.user`).

Redux Toolkit was considered and rejected as more ceremony than three small stores need; plain Context was considered and rejected because of the re-render/selector limitation above, plus the code being noticeably more verbose for the same result.
