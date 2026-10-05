import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/api';
import toast from 'react-hot-toast';
import { User } from '../types';
import { AxiosError } from 'axios';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated, user } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // Already logged in — redirect
  if (isAuthenticated) {
    const target = user?.role === 'admin'
      ? '/admin'
      : user?.isSetupComplete
        ? '/dashboard'
        : '/setup';
    navigate(target, { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      const res = await authApi.login(email.trim().toLowerCase(), password);
      const { token, user: loggedInUser } = res.data as { token: string; user: User };

      setAuth(loggedInUser, token);

      if (loggedInUser.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (!loggedInUser.isSetupComplete) {
        // First login after registration — go finish setup
        navigate('/setup', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const axErr = err as AxiosError<{ message: string }>;
      toast.error(axErr.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="player-auth-shell flex flex-col">

      {/* Nav */}
      <nav className="player-auth-nav relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-3 group">
          <span className="survival-mark">S</span>
          <span className="text-stone-200 font-semibold tracking-[0.28em] text-xs uppercase group-hover:text-rose-200 transition-colors">
            {import.meta.env.VITE_APP_NAME || 'SURVIVAL'}
          </span>
        </Link>
        <Link
          to="/admin/login"
          className="text-stone-500 hover:text-stone-200 text-xs tracking-[0.18em] uppercase transition-colors"
        >
          Admin →
        </Link>
      </nav>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="text-center mb-8">
            <p className="text-rose-200/80 text-[11px] tracking-[0.35em] uppercase mb-3">The arena awaits</p>
            <h1 className="font-display text-5xl text-stone-50 tracking-wide">Enter the game</h1>
            <p className="mt-3 text-sm text-stone-400">Seven days. One final victory.</p>
          </div>

          {/* Card */}
          <div className="player-auth-card p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">

              {/* Email */}
              <div>
                <label className="block text-xs uppercase tracking-[0.18em] text-stone-400 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="player-auth-input"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs uppercase tracking-[0.18em] text-stone-400 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="player-auth-input pr-14"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-200 text-xs transition-colors"
                  >
                    {showPw ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="player-auth-cta mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Logging in…
                  </span>
                ) : (
                  'LOGIN →'
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <p className="text-stone-500 text-sm">
                Don&apos;t have an account?{' '}
                <Link
                  to="/register"
                  className="text-rose-200 hover:text-white font-semibold transition-colors"
                >
                  CREATE ACCOUNT
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link to="/" className="text-stone-600 hover:text-stone-300 text-xs tracking-wider transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
