import React, { useState, useEffect } from 'react';
import AppShell from '../components/layout/AppShell';
import Button from '../components/ui/Button';
import CaseList from '../features/cases/components/CaseList';
import CaseForm from '../features/cases/components/CaseForm';
import useCases from '../features/cases/hooks/useCases';

const CasesPage = () => {
  const [showForm, setShowForm] = useState(false);
  const { cases, loading, error, fetchCases, createCase } = useCases();

  useEffect(() => {
    fetchCases();
  }, []);

  const handleCreateCase = async (formData) => {
    try {
      await createCase(formData);
      setShowForm(false);
      await fetchCases();
    } catch (err) {
      // Error is handled by useCases hook
    }
  };

  return (
    <AppShell>
      {/* Modern Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Investigation Cases
            </h1>
            <p className="text-gray-600 mt-2">
              Manage and track your forensic investigations
            </p>
          </div>
          <Button 
            onClick={() => setShowForm(!showForm)}
            variant={showForm ? "secondary" : "primary"}
            size="lg"
            className="shadow-lg"
          >
            {showForm ? (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Case
              </>
            )}
          </Button>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-600 text-sm font-medium">Total Cases</p>
                <p className="text-2xl font-bold text-indigo-900">{cases?.length || 0}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-600 text-sm font-medium">Active</p>
                <p className="text-2xl font-bold text-emerald-900">
                  {cases?.filter(c => c.status === 'ACTIVE').length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-600 text-sm font-medium">Closed</p>
                <p className="text-2xl font-bold text-amber-900">
                  {cases?.filter(c => c.status === 'CLOSED').length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="mb-8 animate-slide-down">
          <CaseForm onSubmit={handleCreateCase} loading={loading} />
        </div>
      )}

      <CaseList cases={cases} loading={loading} error={error} />
    </AppShell>
  );
};

export default CasesPage;
