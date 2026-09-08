import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CasesPage } from './pages/CasesPage';
import { CaseDetailsPage } from './pages/CaseDetailsPage';
import { RecoveryWorkflowPage } from './pages/RecoveryWorkflowPage';
import { SanitizationPage } from './pages/SanitizationPage';
import { AuditPage } from './pages/AuditPage';
import { ReportsPage } from './pages/ReportsPage';
import { AIAnalystPage } from './pages/AIAnalystPage';
import { AppLayout } from './components/layout/AppLayout';

export const App = () => {
  return (
    <Routes>
      {/* Public Authentication Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Operations Application Routes */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/cases" element={<CasesPage />} />
        <Route path="/cases/:caseId" element={<CaseDetailsPage />} />
        <Route path="/cases/:caseId/recovery" element={<RecoveryWorkflowPage />} />
        <Route path="/cases/:caseId/analyst" element={<AIAnalystPage />} />
        <Route path="/cases/:caseId/forensic-analyst" element={<AIAnalystPage />} />
        <Route path="/recovery" element={<RecoveryWorkflowPage />} />
        <Route path="/analyst" element={<AIAnalystPage />} />
        <Route path="/forensic-analyst" element={<AIAnalystPage />} />
        <Route path="/cases/:caseId/sanitization" element={<SanitizationPage />} />
        <Route path="/sanitization" element={<SanitizationPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;

