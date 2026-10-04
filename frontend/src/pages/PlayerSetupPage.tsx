import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/api';
import toast from 'react-hot-toast';
import { User } from '../types';
import { AxiosError } from 'axios';

export default function PlayerSetupPage() {
  const navigate = useNavigate();
  const { user, setAuth, token } = useAuthStore();

  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [nicknameError, setNicknameError] = useState('');

  if (user?.isSetupComplete && !done) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const playerTag = user?.playerTag ||
    (user?.playerNumber ? `PLAYER ${String(user.playerNumber).padStart(3, '0')}` : 'PLAYER ???');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNicknameError('');
    if (!nickname.trim() || nickname.trim().length < 2) {
      setNicknameError('Nickname must be at least 2 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.setupProfile(nickname.trim());
      const updatedUser = res.data.user as User;
      setAuth(updatedUser, token!);
      setDone(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 2500);
    } catch (err) {
      const axErr = err as AxiosError<{ message: string }>;
      const msg = axErr.response?.data?.message || 'Failed to save nickname. Please try again.';
      setNicknameError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-arena-950 flex flex-col">
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none" />
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-96 bg-cyber-900 rounded-full blur-[160px] opacity-25 pointer-events-none" />

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-5">

          {/* Header */}
          <div className="text-center">
            <p className="text-cyber-400 text-xs tracking-[0.3em] uppercase mb-2">Account Created</p>
            <h1 className="text-3xl font-bold text-white tracking-wide">YOUR PLAYER IDENTITY</h1>
          </div>

          {/* Player ID card */}
          <div className="arena-card cyber-border-active p-6 text-center">
            <p className="text-gray-500 text-xs uppercase tracking-[0.3em] mb-4">🎮 Your Permanent Player ID</p>
            <div className="mb-6">
              <span
                className="text-6xl sm:text-7xl font-bold text-cyber-300 tracking-widest"
                style={{ textShadow: '0 0 30px rgba(0,229,229,0.4)' }}
              >
                {playerTag}
              </span>
              <p className="text-gray-600 text-xs tracking-widest uppercase mt-2">
                This number is permanent and cannot be changed
              </p>
            </div>

            <div className="arena-divider mb-5" />

            {!done ? (
              <form onSubmit={handleSubmit} className="space-y-5 text-left">
                {/* ─── IMPORTANT WhatsApp name notice ─── */}
                <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-400 text-xl shrink-0 mt-0.5">⚠️</span>
                    <div>
                      <p className="text-amber-300 font-bold text-sm uppercase tracking-wide">
                        Important — Read Before Continuing
                      </p>
                      <p className="text-amber-200 text-sm mt-2 leading-relaxed">
                        Use the <strong>EXACT SAME NAME</strong> you are using in the WhatsApp group.
                        Your nickname on this website <strong>must match</strong> the name the
                        organizers know you by in the group.
                      </p>
                      <p className="text-amber-300/80 text-xs mt-2 leading-relaxed">
                        Do not use a different nickname. If your group name is <em>"Precious"</em>,
                        enter <em>"Precious"</em> here — not a username, alias, or variation.
                        This is how you will be identified in the competition.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Nickname input */}
                <div>
                  <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2 text-center">
                    Enter Your Group Name as Nickname
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={e => { setNickname(e.target.value); setNicknameError(''); }}
                    placeholder="e.g. Precious, Shadow, Ghost…"
                    className={`arena-input text-center text-lg tracking-wider ${nicknameError ? 'border-danger-500 focus:border-danger-400' : ''}`}
                    maxLength={30}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                  {nicknameError && (
                    <p className="text-danger-400 text-xs mt-2 text-center">{nicknameError}</p>
                  )}
                  <p className="text-gray-600 text-xs text-center mt-2">
                    2–30 characters · Case will be preserved as-is
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || nickname.trim().length < 2}
                  className="btn-primary w-full text-base py-4"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </span>
                  ) : 'CONFIRM & CONTINUE →'}
                </button>
              </form>
            ) : (
              /* Done state */
              <div className="text-center space-y-3">
                <p className="text-emerald-400 text-sm font-bold tracking-widest uppercase">✓ Identity Confirmed</p>
                <div className="bg-arena-900 rounded-lg px-6 py-4 inline-block">
                  <p className="text-white text-2xl font-bold tracking-wide">{playerTag}</p>
                  <p className="text-cyber-400 text-sm mt-1">
                    Nickname: <span className="text-white font-semibold">{nickname}</span>
                  </p>
                </div>
                <p className="text-gray-500 text-xs mt-3 animate-pulse">Entering the arena…</p>
              </div>
            )}
          </div>

          {/* Info strip */}
          {!done && (
            <div className="flex items-start gap-3 bg-arena-800 border border-arena-700 rounded-lg px-4 py-3">
              <span className="text-lg shrink-0">ℹ️</span>
              <p className="text-gray-400 text-xs leading-relaxed">
                Your <strong className="text-white">Player ID</strong> is your permanent identity.
                Your email is never shown to other players — only your Player ID and nickname are visible.
                Nicknames are unique: no two players can share the same name.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
