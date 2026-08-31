import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import FormField from '../../../components/ui/FormField';
import Spinner from '../../../components/ui/Spinner';

const TYPES = [
  { value: 'CASE_SUMMARY', label: 'Case summary' },
  { value: 'RECOVERY_REPORT', label: 'Recovery report' },
  { value: 'SANITIZATION_CERTIFICATE', label: 'Sanitization certificate' },
  { value: 'AUDIT_REPORT', label: 'Audit report' },
];

const ReportGenerateButton = ({ onGenerate, loading }) => {
  const [type, setType] = useState('CASE_SUMMARY');

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <FormField label="Report type" className="mb-0 flex-1">
        <FormField.Select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FormField.Select>
      </FormField>
      <Button onClick={() => onGenerate(type)} disabled={loading} className="sm:mb-4">
        {loading ? <Spinner size="sm" /> : 'Generate report'}
      </Button>
    </div>
  );
};

export default ReportGenerateButton;
