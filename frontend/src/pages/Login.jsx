import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, Shield, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.success) {
      navigate('/dashboard');
    }
  };

  const setDemoAccount = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Password123!');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and Brand Title */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20 mb-3">
            SW
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Sign in to SpendWise</h2>
          <p className="text-sm text-slate-400 mt-1">
            Enterprise Team Expense & Approval Management
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Corporate Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@spendwise.local"
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              Quick Demo Logins (Click to Autofill)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDemoAccount('dev1@spendwise.local')}
                className="p-2 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-left transition-colors"
              >
                <span className="block font-semibold text-slate-800">Employee</span>
                <span className="block text-[11px] text-slate-500 truncate">dev1@spendwise.local</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('engineering.mgr@spendwise.local')}
                className="p-2 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-left transition-colors"
              >
                <span className="block font-semibold text-slate-800">Manager</span>
                <span className="block text-[11px] text-slate-500 truncate">engineering.mgr@...</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('finance@spendwise.local')}
                className="p-2 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-left transition-colors"
              >
                <span className="block font-semibold text-slate-800">Finance Lead</span>
                <span className="block text-[11px] text-slate-500 truncate">finance@spendwise.local</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('admin@spendwise.local')}
                className="p-2 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-left transition-colors"
              >
                <span className="block font-semibold text-slate-800">Administrator</span>
                <span className="block text-[11px] text-slate-500 truncate">admin@spendwise.local</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Default demo password for all accounts: <code className="bg-slate-100 px-1 py-0.5 rounded">Password123!</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
