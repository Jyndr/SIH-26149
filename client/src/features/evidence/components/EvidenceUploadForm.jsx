import React, { useState, useCallback } from 'react';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import FormField from '../../../components/ui/FormField';
import Spinner from '../../../components/ui/Spinner';
import useEvidenceUpload from '../hooks/useEvidenceUpload';

const EvidenceUploadForm = ({ caseId, onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const { uploadEvidence, uploadProgress, loading, error } = useEvidenceUpload(caseId);

  const handleFileSelect = (selectedFile) => {
    if (selectedFile && selectedFile.size <= 2 * 1024 * 1024 * 1024) {
      setFile(selectedFile);
    } else {
      alert('File size exceeds 2GB limit');
    }
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    try {
      await uploadEvidence(file, description);
      setFile(null);
      setDescription('');
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (err) {
      // Error is handled by useEvidenceUpload hook
    }
  };

  return (
    <Card>
      <Card.Header>
        <h2 className="text-xl font-semibold">Upload Evidence</h2>
      </Card.Header>
      <Card.Body>
        <form onSubmit={handleSubmit}>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer"
            >
              <div className="text-gray-600">
                <p className="text-lg font-medium mb-2">
                  {file ? file.name : 'Drag and drop a file here, or click to select'}
                </p>
                {file && (
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>
            </label>
          </div>

          <FormField label="Description" className="mt-4">
            <FormField.Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter evidence description (optional)"
              rows={3}
            />
          </FormField>

          {error && (
            <div className="mt-4 p-3 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-danger-800 text-sm">{error}</p>
            </div>
          )}

          {uploadProgress > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-4"
            disabled={!file || loading}
          >
            {loading ? <Spinner size="sm" /> : 'Upload Evidence'}
          </Button>
        </form>
      </Card.Body>
    </Card>
  );
};

export default EvidenceUploadForm;
