import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import FormField from '../../../components/ui/FormField';
import Spinner from '../../../components/ui/Spinner';
import useAuth from '../hooks/useAuth';

const LoginForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const { login, loading, error } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(formData);
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
    <Card className="max-w-md w-full">
      {error && (
        <div className="mb-4 p-3 bg-error/10 border border-error rounded flex items-center space-x-2">
          <span className="material-symbols-outlined text-error text-[20px]">error</span>
          <span className="text-error text-sm font-medium">{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-5">
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
              className="pl-xl bg-surface-container-low border border-outline-variant text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary font-code-md"
            />
          </div>
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
              <span className="ml-2">Authenticating...</span>
            </span>
          ) : (
            'Sign In'
          )}
        </Button>
      </form>

      {/* Demo Credentials Hint */}
      <div className="mt-6 p-3 bg-surface-container-low border border-outline-variant rounded">
        <p className="font-code-md text-code-md text-on-surface-variant text-center">
          <span className="text-primary font-semibold">Demo:</span> demo@jyndr.com / demo123
        </p>
      </div>
    </Card>
  );
};

export default LoginForm;
