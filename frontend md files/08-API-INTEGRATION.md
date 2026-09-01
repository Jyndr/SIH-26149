# 08 — API Integration

## 1. Purpose

Defines how the React frontend talks to the Node backend documented in `03-API.md`: the Axios client setup, per-resource API modules, error handling, and how SSE job-progress events are consumed. This is the frontend's equivalent of the backend's `04-PYTHON-INTEGRATION.md` — a single contract document both frontend and backend teams can check against when something doesn't match.

---

## 2. Axios Client (`src/services/api/axiosClient.js`)

One configured Axios instance, imported by every `*.api.js` file. Nothing else in the app creates its own Axios instance.

```js
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // e.g. http://localhost:5000/api/v1
  timeout: 15000,
});

// Request interceptor: attach JWT
axiosClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: unwrap { success, data } and centralize error handling
axiosClient.interceptors.response.use(
  (response) => response.data.data,
  (error) => {
    const apiError = error.response?.data?.error;
    const message = apiError?.message || 'Something went wrong. Please try again.';

    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      // router redirect to /login handled by ProtectedRoute reacting to isAuthenticated
    }

    useUIStore.getState().pushToast('error', message);
    return Promise.reject(apiError || error);
  }
);

export default axiosClient;
```

**Why unwrap `{ success, data }` here:** every backend response follows that envelope (per `03-API.md`), so unwrapping once in the interceptor means every `*.api.js` function just returns the useful payload directly — no repeated `.data.data` across 30+ call sites.

**Why centralize the error toast here:** individual hooks still receive the rejected promise (for local error state, e.g. disabling a submit button), but the user-facing "something went wrong" notification doesn't need to be re-implemented in every hook — one interceptor, one behavior, consistent everywhere.

---

## 3. Per-Resource API Modules

Each file exports plain async functions, one per backend endpoint, named to match the resource — no classes, no unnecessary wrapping.

```js
// services/api/cases.api.js
import axiosClient from './axiosClient';

export const casesApi = {
  create: (payload) => axiosClient.post('/cases', payload),
  list: (params) => axiosClient.get('/cases', { params }),
  getById: (caseId) => axiosClient.get(`/cases/${caseId}`),
  update: (caseId, payload) => axiosClient.patch(`/cases/${caseId}`, payload),
};
```

The same pattern applies to every module, matching `03-API.md` section-for-section:

| File | Endpoints covered |
|---|---|
| `auth.api.js` | register, login, me |
| `cases.api.js` | create, list, getById, update |
| `evidence.api.js` | upload (multipart), list, getById, verify |
| `jobs.api.js` | getById (SSE handled separately, see Section 5) |
| `sanitization.api.js` | sanitizeFile, sanitizeFolder, sanitizeDrive, getJob |
| `audit.api.js` | listForCase, getById, verify |
| `reports.api.js` | generate, listForCase, getById, download |

Evidence upload needs `multipart/form-data` and upload-progress reporting, so it's written explicitly rather than through the generic pattern:

```js
// services/api/evidence.api.js
upload: (caseId, file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosClient.post(`/cases/${caseId}/evidence`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / e.total)),
  });
},
```

---

## 4. Hook Layer (calling API modules)

Feature hooks are the only consumers of `services/api/*`. A hook's job: call the API function, manage `loading`/`error`/`data` local state, and optionally sync a result into a Zustand store (see `07-STATE-MANAGEMENT.md`, Section 4).

```js
// features/evidence/hooks/useEvidenceUpload.js
export function useEvidenceUpload(caseId) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const upload = async (file) => {
    setUploading(true);
    setError(null);
    try {
      const evidence = await evidenceApi.upload(caseId, file, setProgress);
      return evidence;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return { upload, progress, uploading, error };
}
```

---

## 5. Consuming SSE Job Events

Backend exposes `GET /jobs/:jobId/events` as documented in `03-API.md`. Since native `EventSource` cannot set an `Authorization` header, the token is passed as a query param, matching the backend's documented workaround.

```js
// hooks/useSSE.js
export function useSSE(url, handlers) {
  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url);
    Object.entries(handlers).forEach(([eventName, handler]) => {
      es.addEventListener(eventName, (e) => handler(JSON.parse(e.data)));
    });
    es.onerror = () => es.close(); // browser auto-retries by default; explicit close on repeated failure can be added if needed
    return () => es.close();
  }, [url]);
}
```

```js
// features/jobs/hooks/useJobEvents.js
export function useJobEvents(jobId) {
  const [job, setJob] = useState(null);
  const { token } = useAuthStore();
  const url = jobId
    ? `${import.meta.env.VITE_API_BASE_URL}/jobs/${jobId}/events?token=${token}`
    : null;

  useSSE(url, {
    progress: (data) => setJob((j) => ({ ...j, ...data })),
    completed: (data) => setJob((j) => ({ ...j, ...data })),
    failed: (data) => setJob((j) => ({ ...j, ...data })),
  });

  return job;
}
```

`JobProgressPanel` (in `features/jobs/components/`) uses this hook directly — no page component opens an `EventSource` itself, and cleanup on unmount is guaranteed by the hook's `useEffect` return.

---

## 6. Error Handling Summary

| Layer | Responsibility |
|---|---|
| Axios response interceptor | Unwrap envelope, push a global error toast, force logout on 401 |
| Feature hook | Capture the same error into local `error` state for inline UI (disabled buttons, form field errors, retry prompts) |
| Component | Reads the hook's `error`/`loading` to render inline states — never touches Axios or raw error objects |

This two-tier handling (global toast + local inline state) means a failed evidence upload both shows a toast *and* keeps the upload form usable to retry, without every hook re-implementing toast logic.

---

## 7. Environment Configuration

```text
# .env.example
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

Read once in `src/config/env.js`, never `import.meta.env` directly scattered across files, so a future change (e.g. a staging URL) touches one file.
