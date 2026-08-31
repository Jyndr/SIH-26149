import React from 'react';
import { Navigate } from 'react-router-dom';
import RegisterForm from '../features/auth/components/RegisterForm';
import useAuthStore from '../store/authStore';

const RegisterPage = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/cases" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <RegisterForm />
    </div>
  );
};

export default RegisterPage;
