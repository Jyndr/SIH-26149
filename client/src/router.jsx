import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CasesPage from './pages/CasesPage';
import CaseDetailPage from './pages/CaseDetailPage';
import EvidenceDetailPage from './pages/EvidenceDetailPage';
import JobPage from './pages/JobPage';
import SanitizationPage from './pages/SanitizationPage';
import AuditPage from './pages/AuditPage';
import ReportsPage from './pages/ReportsPage';
import NotFoundPage from './pages/NotFoundPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Navigate to="/cases" replace />
      </ProtectedRoute>
    ),
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/cases',
    element: (
      <ProtectedRoute>
        <CasesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/cases/:caseId',
    element: (
      <ProtectedRoute>
        <CaseDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/cases/:caseId/evidence/:evidenceId',
    element: (
      <ProtectedRoute>
        <EvidenceDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/cases/:caseId/jobs/:jobId',
    element: (
      <ProtectedRoute>
        <JobPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/cases/:caseId/sanitize',
    element: (
      <ProtectedRoute>
        <SanitizationPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/cases/:caseId/audit',
    element: (
      <ProtectedRoute>
        <AuditPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/cases/:caseId/reports',
    element: (
      <ProtectedRoute>
        <ReportsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

export default router;
