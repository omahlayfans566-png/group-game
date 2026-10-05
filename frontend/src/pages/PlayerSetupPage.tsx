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
    <div className="player-auth-shell flex flex-col">

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-5">

          {/* Header */}
          <div className="text-center">
            <p className="text-rose-200/80 text-[11px] tracking-[0.35em] uppercase mb-2">Your invitation is ready</p>
            <h1 className="font-display text-4xl text-stone-50 tracking-wide">Choose your player name</h1>
            <p className="mt-3 text-sm text-stone-400">This is the name the arena will know you by.</p>
          </div>

          {/* Player ID card */}
          <div className="player-auth-card p-6 text-center">
            <p className="text-stone-400 text-xs uppercase tracking-[0.3em] mb-4">Your permanent player ID</p>
            <div className="mb-6">
              <span
                className="font-display text-6xl sm:text-7xl text-rose-100 tracking-widest"
              >
                {playerTag}
              </span>
              <p className="text-stone-500 text-xs tracking-widest uppercase mt-2">
                This number stays with you
              </p>
            </div>

            <div className="arena-divider mb-5" />

            {!done ? (
              <form onSubmit={handleSubmit} className="space-y-5 text-left">
                {/* ─── IMPORTANT WhatsApp name notice ─── */}
                <div className="bg-rose-950/25 border border-rose-200/20 rounded-2xl p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-rose-200 text-xl shrink-0 mt-0.5">✦</span>
                    <div>
                      <p className="text-rose-100 font-bold text-sm uppercase tracking-wide">
                        Important — Read Before Continuing
                      </p>
                      <p className="text-stone-300 text-sm mt-2 leading-relaxed">
                        Use the <strong>EXACT SAME NAME</strong> you are using in the WhatsApp group.
                        Your nickname on this website <strong>must match</strong> the name the
                        organizers know you by in the group.
                      </p>
                      <p className="text-stone-400 text-xs mt-2 leading-relaxed">
                        Do not use a different nickname. If your group name is <em>"Precious"</em>,
                        enter <em>"Precious"</em> here — not a username, alias, or variation.
                        This is how you will be identified in the competition.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Nickname input */}
                <div>
                  <label className="block text-xs uppercase tracking-[0.18em] text-stone-400 mb-2 text-center">
                    Player name
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={e => { setNickname(e.target.value); setNicknameError(''); }}
                    placeholder="e.g. Precious, Shadow, Ghost…"
                    className={`player-auth-input text-center text-lg tracking-wider ${nicknameError ? 'border-danger-500 focus:border-danger-400' : ''}`}
                    maxLength={30}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                  {nicknameError && (
                    <p className="text-danger-400 text-xs mt-2 text-center">{nicknameError}</p>
                  )}
                  <p className="text-stone-500 text-xs text-center mt-2">
                    Use the same name you use in the game group.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || nickname.trim().length < 2}
                  className="player-auth-cta"
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
                <p className="text-emerald-200 text-sm font-bold tracking-widest uppercase">Identity confirmed</p>
                <div className="bg-arena-900 rounded-lg px-6 py-4 inline-block">
                  <p className="text-white text-2xl font-bold tracking-wide">{playerTag}</p>
                  <p className="text-rose-200 text-sm mt-1">
                    Nickname: <span className="text-white font-semibold">{nickname}</span>
                  </p>
                </div>
                <p className="text-stone-400 text-xs mt-3 animate-pulse">Entering the arena…</p>
              </div>
            )}
          </div>

          {/* Info strip */}
          {!done && (
            <div className="flex items-start gap-3 bg-black/20 border border-white/10 rounded-2xl px-4 py-3">
              <span className="text-lg shrink-0 text-rose-200">i</span>
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
