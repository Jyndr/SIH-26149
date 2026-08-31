import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import FormField from '../../../components/ui/FormField';
import Spinner from '../../../components/ui/Spinner';

const CaseForm = ({ onSubmit, initialData = {}, loading = false }) => {
  const [formData, setFormData] = useState({
    title: initialData.title || '',
    description: initialData.description || '',
    status: initialData.status || 'OPEN',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <Card>
      <Card.Header>
        <h2 className="text-xl font-semibold">
          {initialData._id ? 'Edit Case' : 'Create New Case'}
        </h2>
      </Card.Header>
      <Card.Body>
        <form onSubmit={handleSubmit}>
          <FormField label="Title" required>
            <FormField.Input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter case title"
              required
            />
          </FormField>

          <FormField label="Description">
            <FormField.Textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter case description"
              rows={4}
            />
          </FormField>

          {initialData._id && (
            <FormField label="Status">
              <FormField.Select name="status" value={formData.status} onChange={handleChange}>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="CLOSED">Closed</option>
                <option value="ARCHIVED">Archived</option>
              </FormField.Select>
            </FormField>
          )}

          <div className="mt-6">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? <Spinner size="sm" /> : (initialData._id ? 'Update Case' : 'Create Case')}
            </Button>
          </div>
        </form>
      </Card.Body>
    </Card>
  );
};

export default CaseForm;
