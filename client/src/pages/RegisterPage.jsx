import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import RegisterForm from '../features/auth/components/RegisterForm';
import useAuthStore from '../store/authStore';

const RegisterPage = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#0F0F10] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl border border-outline-variant mb-4">
            <span className="material-symbols-outlined text-primary text-[32px]">shield</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Create Account</h1>
          <p className="font-code-md text-code-md text-on-surface-variant">Join ForensicGuard to start your forensic analysis</p>
        </div>

        {/* Register Form Card */}
        <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded p-lg">
          <RegisterForm />
          
          <div className="mt-6 text-center">
            <p className="text-on-surface-variant font-body-md">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-primary hover:text-primary/80 font-medium font-label-caps uppercase"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-on-surface-variant text-sm mt-8 font-code-md">
          © 2026 ForensicGuard. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
