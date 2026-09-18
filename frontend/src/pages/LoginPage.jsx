import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Key, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        await authApi.register({ name, email, password });
        setIsRegistering(false);
        setError('Account created. Sign in with your new credentials.');
      } else {
        const result = await login(email, password);
        if (result.success) {
          navigate('/dashboard');
        } else {
          setError(result.error || 'Invalid credentials. Please verify your email and password.');
        }
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Could not create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
        {/* Brand Icon & Heading */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white mb-3 shadow-xs">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            {isRegistering ? 'Create your Cyphora account' : 'Sign in to Cyphora'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Digital forensics evidence recovery and secure data erasure
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Investigator name"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="investigator@agency.com"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                {isRegistering ? 'Creating Account...' : 'Signing In...'}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                {isRegistering ? 'Create Account' : 'Sign In'}
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          {isRegistering ? 'Already have an account?' : 'New to Cyphora?'}{' '}
          <button
            type="button"
            onClick={() => { setIsRegistering((value) => !value); setError(''); }}
            className="text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer"
          >
            {isRegistering ? 'Sign in' : 'Create an account'}
          </button>
        </div>

      </div>

      {/* Compliance Notice */}
      <div className="mt-6 text-center text-xs text-slate-400 max-w-sm">
        <p>NIST SP 800-88 & ISO/IEC 27037 forensic standards compliant</p>
      </div>
    </div>
  );
};
