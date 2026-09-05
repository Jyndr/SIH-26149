import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Key, Mail, Terminal, AlertCircle, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const [email, setEmail] = useState('demo@jyndr.com');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Authentication failure: verify investigator credentials');
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@jyndr.com');
    setPassword('demo123');
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#060a12] flex flex-col justify-center items-center p-4 forensic-grid select-none">
      {/* Decorative Top Banner */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between text-[11px] font-mono text-slate-500 border-b border-slate-800/80 pb-2">
        <span className="flex items-center gap-1.5 text-cyan-400">
          <Terminal className="w-3.5 h-3.5" />
          <span>TERMINAL // AUTH_GATEWAY</span>
        </span>
        <span>NODE: LOCAL-5174</span>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-[#0b1329]/95 border border-slate-700/80 rounded-lg shadow-2xl shadow-black/90 p-8 backdrop-blur-md relative overflow-hidden">
        {/* Subtle accent border line on top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"></div>

        {/* Brand Icon & Heading */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-lg bg-cyan-950/70 border border-cyan-500/50 flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-wider text-slate-100 uppercase font-mono">
            Jyndr Forensic Platform
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Secure Data Erasure & Advanced File Recovery Platform
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded bg-rose-950/60 border border-rose-600/50 text-rose-300 text-xs flex items-start gap-2.5 font-mono">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wider">
              Investigator Email / UID
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="investigator@agency.gov"
                className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700 rounded text-slate-100 font-mono text-sm placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wider">
              Cryptographic Key / Password
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700 rounded text-slate-100 font-mono text-sm placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                AUTHENTICATING...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                AUTHENTICATE SESSION
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </form>

        {/* Demo Credentials Quick-Fill helper */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Demo Investigator:</span>
          <button
            type="button"
            onClick={handleFillDemo}
            className="text-cyan-400 hover:text-cyan-300 underline font-semibold transition-colors"
          >
            Auto-fill demo credentials
          </button>
        </div>
      </div>

      {/* Compliance Notice */}
      <div className="mt-6 text-center text-[10px] font-mono text-slate-400 max-w-sm">
        <p>RESTRICTED ACCESS // DIGITAL FORENSICS CHAIN OF CUSTODY PRESERVED</p>
        <p className="text-slate-500 mt-1">NIST SP 800-88 & ISO/IEC 27037 FORENSIC COMPLIANT</p>
      </div>
    </div>
  );
};
