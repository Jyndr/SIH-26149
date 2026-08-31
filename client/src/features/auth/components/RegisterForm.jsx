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
    <Card className="max-w-md mx-auto">
      <Card.Header>
        <h1 className="text-2xl font-bold text-center">Register</h1>
        <p className="text-center text-gray-600 text-sm mt-2">
          Create an account to access the forensic tool
        </p>
      </Card.Header>
      <Card.Body>
        <form onSubmit={handleSubmit}>
          <FormField label="Name" error={error}>
            <FormField.Input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
            />
          </FormField>

          <FormField label="Email">
            <FormField.Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
            />
          </FormField>

          <FormField label="Password">
            <FormField.Input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
              minLength={6}
            />
          </FormField>

          <FormField label="Role">
            <FormField.Select
              name="role"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="INVESTIGATOR">Investigator</option>
              <option value="ADMIN">Admin</option>
            </FormField.Select>
          </FormField>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-4"
            disabled={loading}
          >
            {loading ? <Spinner size="sm" /> : 'Register'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Login
            </Link>
          </p>
        </div>
      </Card.Body>
    </Card>
  );
};

export default RegisterForm;
