import axios, { AxiosInstance, AxiosError } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from localStorage on every request
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('sg_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — redirect to login
axiosInstance.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sg_token');
      localStorage.removeItem('sg_user');
      // Only redirect if not already on auth pages
      if (!window.location.pathname.includes('/login') && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    axiosInstance.post('/auth/login', { email, password }),

  register: (email: string, password: string) =>
    axiosInstance.post('/auth/register', { email, password }),

  setupProfile: (nickname: string) =>
    axiosInstance.post('/auth/setup-profile', { nickname }),

  registerAdmin: (data: {
    email: string;
    password: string;
    nickname: string;
    adminSecret: string;
  }) => axiosInstance.post('/auth/register-admin', data),

  me: () => axiosInstance.get('/auth/me'),

  logout: () => axiosInstance.post('/auth/logout'),
};

// ─── Games ────────────────────────────────────────────────────────────────────

export const gamesApi = {
  getAll: () => axiosInstance.get('/games'),
  getAdminOverview: () => axiosInstance.get('/games/admin-overview'),
  getAdminSchedule: () => axiosInstance.get('/games/admin-schedule'),
  getServerTime: () => axiosInstance.get('/games/server-time'),
  getSchedule: () => axiosInstance.get('/games/schedule'),
  getOne: (gameId: string) => axiosInstance.get(`/games/${gameId}`),
  create: (data: Record<string, unknown>) => axiosInstance.post('/games', data),
  update: (gameId: string, data: Record<string, unknown>) =>
    axiosInstance.patch(`/games/${gameId}`, data),
  delete: (gameId: string) => axiosInstance.delete(`/games/${gameId}`),

  getDays: (gameId: string) => axiosInstance.get(`/games/${gameId}/days`),
  createDay: (gameId: string, data: Record<string, unknown>) =>
    axiosInstance.post(`/games/${gameId}/days`, data),
  updateDay: (gameId: string, dayId: string, data: Record<string, unknown>) =>
    axiosInstance.patch(`/games/${gameId}/days/${dayId}`, data),

  getPlayers: (gameId: string) => axiosInstance.get(`/games/${gameId}/players`),
  enrollPlayer: (gameId: string, userId: string) =>
    axiosInstance.post(`/games/${gameId}/enroll/${userId}`),
  enrollBulk: (gameId: string, userIds: string[]) =>
    axiosInstance.post(`/games/${gameId}/enroll-bulk`, { userIds }),
  getStats: (gameId: string) => axiosInstance.get(`/games/${gameId}/stats`),

  getAnnouncements: (gameId: string) =>
    axiosInstance.get(`/games/${gameId}/announcements`),
  createAnnouncement: (gameId: string, data: Record<string, unknown>) =>
    axiosInstance.post(`/games/${gameId}/announcements`, data),
  publishAnnouncement: (gameId: string, annId: string) =>
    axiosInstance.patch(`/games/${gameId}/announcements/${annId}/publish`, {}),

  // Admin game-day open/close controls
  openDay: (gameId: string, dayId: string, forceCloseOthers = false) =>
    axiosInstance.post(`/games/${gameId}/days/${dayId}/open`, { forceCloseOthers }),
  closeDay: (gameId: string, dayId: string, endActiveAttempts = false) =>
    axiosInstance.post(`/games/${gameId}/days/${dayId}/close`, { endActiveAttempts }),
  getDayLiveStats: (gameId: string, dayId: string) =>
    axiosInstance.get(`/games/${gameId}/days/${dayId}/live-stats`),

  // Player dashboard endpoints
  getAllDays: () => axiosInstance.get('/games/all-days'),
  getActiveDay: () => axiosInstance.get('/games/active-day'),
};

// ─── Challenges ───────────────────────────────────────────────────────────────

export const challengesApi = {
  getAll: (params?: { gameId?: string; dayNumber?: number }) =>
    axiosInstance.get('/challenges', { params }),
  audit: (gameId: string) => axiosInstance.get('/challenges/audit', { params: { gameId } }),
  getAdminResults: (params: { gameId?: string; dayNumber?: number | ''; status?: string }) =>
    axiosInstance.get('/challenges/admin-results', { params }),
  getOne: (id: string) => axiosInstance.get(`/challenges/${id}`),
  create: (data: Record<string, unknown>) => axiosInstance.post('/challenges', data),
  update: (id: string, data: Record<string, unknown>) =>
    axiosInstance.patch(`/challenges/${id}`, data),
  delete: (id: string) => axiosInstance.delete(`/challenges/${id}`),

  startChallenge: (id: string) => axiosInstance.post(`/challenges/${id}/start`),
  submitChallenge: (id: string, data: { attemptId: string; answers: Record<string, unknown> }) =>
    axiosInstance.post(`/challenges/${id}/submit`, data),
  submitStage: (id: string, data: { attemptId: string; stage: number; payload: Record<string, unknown> }) =>
    axiosInstance.post(`/challenges/${id}/submit-stage`, data),
  getMyAttempt: (id: string) => axiosInstance.get(`/challenges/${id}/my-attempt`),

  getAttempts: (id: string) => axiosInstance.get(`/challenges/${id}/attempts`),
  getSubmissions: (id: string) => axiosInstance.get(`/challenges/${id}/submissions`),
};

// ─── Elimination Schedule ─────────────────────────────────────────────────────

export const eliminationApi = {
  getSchedule: (gameId: string) => axiosInstance.get(`/elimination/${gameId}/schedule`),
  autoGenerate: (gameId: string) => axiosInstance.post(`/elimination/${gameId}/auto-generate`),
  updateDay: (gameId: string, dayId: string, eliminationCount: number) =>
    axiosInstance.patch(`/elimination/${gameId}/day/${dayId}`, { eliminationCount }),
  runElimination: (gameId: string, dayId: string) =>
    axiosInstance.post(`/elimination/${gameId}/run/${dayId}`),
  getHistory: (gameId: string) => axiosInstance.get(`/elimination/${gameId}/history`),
};

export const playersApi = {
  getAll: () => axiosInstance.get('/players'),
  getOne: (userId: string) => axiosInstance.get(`/players/${userId}`),
  create: (data: Record<string, unknown>) => axiosInstance.post('/players', data),
  update: (userId: string, data: Record<string, unknown>) =>
    axiosInstance.patch(`/players/${userId}`, data),
  resetPassword: (userId: string, newPassword: string) =>
    axiosInstance.post(`/players/${userId}/reset-password`, { newPassword }),
  deactivate: (userId: string) => axiosInstance.delete(`/players/${userId}`),

  getGames: (userId: string) => axiosInstance.get(`/players/${userId}/games`),
  getSubmissions: (userId: string, gameId?: string) =>
    axiosInstance.get(`/players/${userId}/submissions`, { params: { gameId } }),
  getAttempts: (userId: string, challengeId?: string) =>
    axiosInstance.get(`/players/${userId}/attempts`, { params: { challengeId } }),

  eliminate: (data: {
    gameId: string;
    gameDayId: string;
    dayNumber: number;
    eliminationCount: number;
  }) => axiosInstance.post('/players/eliminate', data),

  declareWinner: (gameId: string, userId: string) =>
    axiosInstance.post('/players/declare-winner', { gameId, userId }),

  getEliminations: (gameId: string) =>
    axiosInstance.get(`/players/eliminations/${gameId}`),
};
