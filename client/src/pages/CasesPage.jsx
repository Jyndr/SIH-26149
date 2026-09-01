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
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Investigation Cases</h2>
            <p className="font-code-md text-code-md text-on-surface-variant">Manage and track your forensic investigations</p>
          </div>
          <Button 
            onClick={() => setShowForm(!showForm)}
            variant={showForm ? "secondary" : "primary"}
            className="font-label-caps text-label-caps uppercase"
          >
            {showForm ? 'Cancel' : 'New Case'}
          </Button>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md mt-6">
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] p-md rounded flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-start mb-lg">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Total Cases</span>
              <span className="material-symbols-outlined text-primary text-[20px]">folder_open</span>
            </div>
            <div className="mt-auto">
              <div className="font-headline-lg text-headline-lg text-on-surface">{cases?.length || 0}</div>
            </div>
          </div>
          
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] p-md rounded flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-start mb-lg">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Active</span>
              <span className="material-symbols-outlined text-secondary text-[20px]">check_circle</span>
            </div>
            <div className="mt-auto">
              <div className="font-headline-lg text-headline-lg text-on-surface">
                {cases?.filter(c => c.status === 'ACTIVE').length || 0}
              </div>
            </div>
          </div>
          
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] p-md rounded flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-start mb-lg">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Closed</span>
              <span className="material-symbols-outlined text-tertiary text-[20px]">task_alt</span>
            </div>
            <div className="mt-auto">
              <div className="font-headline-lg text-headline-lg text-on-surface">
                {cases?.filter(c => c.status === 'CLOSED').length || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="mb-8">
          <CaseForm onSubmit={handleCreateCase} loading={loading} />
        </div>
      )}

      <CaseList cases={cases} loading={loading} error={error} />
    </AppShell>
  );
};

export default CasesPage;
