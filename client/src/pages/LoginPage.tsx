import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, Sparkles, UserCheck } from 'lucide-react';

interface LoginPageProps {
  onNavigateRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await login(demoEmail, 'password123');
    } catch (err: any) {
      setError(err.message || 'Quick login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background radial glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#121929]/95 border border-slate-800 rounded-3xl shadow-2xl p-8 z-10 backdrop-blur-xl animate-in fade-in duration-300">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 p-[1.5px] shadow-xl shadow-blue-600/25 mb-4">
            <div className="w-full h-full bg-[#0b0f19] rounded-[14px] flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-blue-500 animate-pulse" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            deep<span className="text-blue-500">-nav</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Premium video-conferencing with permanent rooms
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-medium text-center">
            {error}
          </div>
        )}

        {/* Quick Demo Switcher */}
        <div className="mb-6 p-3.5 bg-[#182337] border border-slate-700/80 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            One-Click Demo Accounts
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickLogin('demo@deepnav.io')}
              className="flex items-center space-x-2 p-2 rounded-xl bg-[#131b2e] hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500/40 text-left transition"
            >
              <img
                src="https://api.dicebear.com/7.x/bottts/svg?seed=Alex"
                alt="Alex"
                className="w-7 h-7 rounded-full bg-slate-800"
              />
              <div className="overflow-hidden">
                <span className="text-xs font-bold text-white block truncate">Admin (Host)</span>
                <span className="text-[10px] text-blue-400">Host / Owner</span>
              </div>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickLogin('sarah@deepnav.io')}
              className="flex items-center space-x-2 p-2 rounded-xl bg-[#131b2e] hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500/40 text-left transition"
            >
              <img
                src="https://api.dicebear.com/7.x/bottts/svg?seed=Sarah"
                alt="Sarah"
                className="w-7 h-7 rounded-full bg-slate-800"
              />
              <div className="overflow-hidden">
                <span className="text-xs font-bold text-white block truncate">Sarah Chen</span>
                <span className="text-[10px] text-indigo-400">Participant</span>
              </div>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#182337] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#182337] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2"
          >
            <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Switch to Register */}
        <div className="mt-6 text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <button
            onClick={onNavigateRegister}
            className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 ml-1"
          >
            Create account
          </button>
        </div>
      </div>
    </div>
  );
};
