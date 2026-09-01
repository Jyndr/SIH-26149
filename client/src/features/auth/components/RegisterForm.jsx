import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import FormField from '../../../components/ui/FormField';
import Spinner from '../../../components/ui/Spinner';
import useAuth from '../hooks/useAuth';

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'INVESTIGATOR',
  });
  const { register, loading, error } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(formData);
    } catch (err) {
      // Error is handled by useAuth hook
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <Card className="max-w-md">
      {error && (
        <div className="mb-4 p-3 bg-error/10 border border-error rounded flex items-center space-x-2">
          <span className="material-symbols-outlined text-error text-[20px]">error</span>
          <span className="text-error text-sm font-medium">{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField label="Full Name">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline-variant">person</span>
            <FormField.Input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
              className="pl-xl bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary font-code-md"
            />
          </div>
        </FormField>

        <FormField label="Email Address">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline-variant">email</span>
            <FormField.Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="name@company.com"
              required
              className="pl-xl bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary font-code-md"
            />
          </div>
        </FormField>

        <FormField label="Password">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline-variant">lock</span>
            <FormField.Input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              minLength={6}
              className="pl-xl bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary font-code-md"
            />
          </div>
        </FormField>

        <FormField label="Role">
          <FormField.Select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="bg-surface-container-low border border-outline-variant text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-code-md"
          >
            <option value="INVESTIGATOR">Investigator</option>
            <option value="ADMIN">Admin</option>
          </FormField.Select>
        </FormField>

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-6 font-label-caps text-label-caps uppercase"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <Spinner size="sm" />
              <span className="ml-2">Creating Account...</span>
            </span>
          ) : (
            'Register'
          )}
        </Button>
      </form>
    </Card>
  );
};

export default RegisterForm;
