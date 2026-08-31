import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import FormField from '../../../components/ui/FormField';
import Modal from '../../../components/ui/Modal';
import Spinner from '../../../components/ui/Spinner';

const SanitizeForm = ({ onSubmit, loading }) => {
  const [formData, setFormData] = useState({
    target: '',
    targetType: 'FILE',
    method: 'ZERO_FILL',
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.target.trim()) return;
    setConfirmOpen(true);
  };

  const confirm = () => {
    setConfirmOpen(false);
    onSubmit({
      target: formData.target.trim(),
      targetType: formData.targetType,
      method: formData.method,
    });
  };

  return (
    <>
      <Card>
        <Card.Header>
          <h2 className="text-xl font-semibold">Sanitize target</h2>
          <p className="mt-1 text-sm text-gray-600">
            This operation is destructive and cannot be undone.
          </p>
        </Card.Header>
        <Card.Body>
          <form onSubmit={handleSubmit}>
            <FormField label="Target path">
              <FormField.Input
                name="target"
                value={formData.target}
                onChange={handleChange}
                placeholder="/path/to/file, folder, or drive"
                required
              />
            </FormField>
            <FormField label="Target type">
              <FormField.Select name="targetType" value={formData.targetType} onChange={handleChange}>
                <option value="FILE">File</option>
                <option value="FOLDER">Folder</option>
                <option value="DRIVE">Drive</option>
              </FormField.Select>
            </FormField>
            <FormField label="Method">
              <FormField.Select name="method" value={formData.method} onChange={handleChange}>
                <option value="ZERO_FILL">Zero fill</option>
                <option value="RANDOM">Random overwrite</option>
                <option value="CRYPTO_ERASE">Crypto erase</option>
              </FormField.Select>
            </FormField>
            <Button type="submit" variant="warning" className="w-full mt-2" disabled={loading || !formData.target.trim()}>
              {loading ? <Spinner size="sm" /> : 'Request sanitization'}
            </Button>
          </form>
        </Card.Body>
      </Card>
      <Modal open={confirmOpen} title="Confirm sanitization" onClose={() => setConfirmOpen(false)}>
        <p className="text-sm text-gray-700">
          Permanently sanitize <span className="font-mono">{formData.target}</span> using {formData.method}?
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={confirm}>Yes, sanitize</Button>
        </div>
      </Modal>
    </>
  );
};

export default SanitizeForm;
