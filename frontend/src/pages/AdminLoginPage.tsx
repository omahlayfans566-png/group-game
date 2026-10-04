import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/api';
import toast from 'react-hot-toast';
import { User } from '../types';
import { AxiosError } from 'axios';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated, user } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    navigate(user?.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    try {
      const res = await authApi.login(email.trim().toLowerCase(), password);
      const { token, user: loggedInUser } = res.data as { token: string; user: User };

      if (loggedInUser.role !== 'admin') {
        toast.error('This portal is for administrators only.');
        return;
      }

      setAuth(loggedInUser, token);
      navigate('/admin');
    } catch (err) {
      const axiosErr = err as AxiosError<{ message: string }>;
      const msg = axiosErr.response?.data?.message || 'Login failed.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-arena-950 flex flex-col">
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none" />
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-danger-900 rounded-full blur-[150px] opacity-10 pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-arena-700">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-cyber-400">⚔</span>
          <span className="text-white font-bold tracking-[0.15em] text-sm uppercase group-hover:text-cyber-300 transition-colors">
            {import.meta.env.VITE_APP_NAME || 'SURVIVAL'}
          </span>
        </Link>
        <Link to="/login" className="text-gray-600 hover:text-gray-400 text-xs tracking-widest uppercase transition-colors">
          Player Login →
        </Link>
      </nav>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-danger-900 border border-danger-700 rounded-lg mb-4">
              <span className="text-xl">🛡</span>
            </div>
            <p className="text-danger-400 text-xs tracking-[0.3em] uppercase mb-2">Restricted Access</p>
            <h1 className="text-4xl font-bold text-white tracking-wide">ADMIN PANEL</h1>
            <p className="text-gray-500 text-sm mt-2">Administrator credentials required</p>
          </div>

          {/* Card */}
          <div className="arena-card danger-border p-8">
            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">
                  Admin Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@email.com"
                  className="arena-input"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="arena-input pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="btn-danger w-full text-base py-4 mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  'ACCESS ADMIN PANEL →'
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-arena-600">
              <p className="text-gray-600 text-xs text-center">
                This portal is for game administrators only.<br />
                Unauthorized access attempts are logged.
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
