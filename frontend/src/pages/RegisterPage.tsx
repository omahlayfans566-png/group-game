import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/api';
import toast from 'react-hot-toast';
import { User } from '../types';
import { AxiosError } from 'axios';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useAuthStore();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);

  // Already logged in — redirect
  if (isAuthenticated) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      const res = await authApi.register(email.trim().toLowerCase(), password);
      const { token, user } = res.data as { token: string; user: User };

      setAuth(user, token);

      // Always go to setup — isSetupComplete is false on fresh registration
      navigate('/setup', { replace: true });
    } catch (err) {
      const axErr = err as AxiosError<{ message: string }>;
      toast.error(axErr.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-arena-950 flex flex-col">
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none" />
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyber-900 rounded-full blur-[140px] opacity-20 pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-arena-700">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-cyber-400">⚔</span>
          <span className="text-white font-bold tracking-[0.15em] text-sm uppercase group-hover:text-cyber-300 transition-colors">
            {import.meta.env.VITE_APP_NAME || 'SURVIVAL'}
          </span>
        </Link>
        <Link to="/login" className="text-gray-500 hover:text-gray-300 text-xs tracking-widest uppercase transition-colors">
          Login →
        </Link>
      </nav>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="text-center mb-8">
            <p className="text-cyber-400 text-xs tracking-[0.3em] uppercase mb-3">Join the Game</p>
            <h1 className="text-4xl font-bold text-white tracking-wide">CREATE ACCOUNT</h1>
            <p className="text-gray-500 text-sm mt-2">
              Enter the arena. A unique Player ID will be assigned to you.
            </p>
          </div>

          {/* Card */}
          <div className="arena-card cyber-border p-8">
            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">

              {/* Email */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="arena-input"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="arena-input pr-14"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs transition-colors"
                  >
                    {showPw ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || password.length < 6}
                className="btn-primary w-full text-base py-4 mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : (
                  'CREATE ACCOUNT →'
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-arena-600 text-center">
              <p className="text-gray-500 text-sm">
                Already have an account?{' '}
                <Link to="/login" className="text-cyber-400 hover:text-cyber-300 font-semibold transition-colors">
                  LOGIN
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link to="/" className="text-gray-600 hover:text-gray-400 text-xs tracking-wider transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
