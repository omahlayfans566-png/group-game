import { create } from 'zustand';
import { User } from '../types';
import { connectSocket, disconnectSocket } from '../lib/socket';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  initFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: (user, token) => {
    localStorage.setItem('sg_token', token);
    localStorage.setItem('sg_user', JSON.stringify(user));
    connectSocket(token);
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  clearAuth: () => {
    localStorage.removeItem('sg_token');
    localStorage.removeItem('sg_user');
    disconnectSocket();
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  initFromStorage: () => {
    try {
      const token = localStorage.getItem('sg_token');
      const userStr = localStorage.getItem('sg_user');
      if (token && userStr) {
        const user = JSON.parse(userStr) as User;
        connectSocket(token);
        set({ user, token, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      localStorage.removeItem('sg_token');
      localStorage.removeItem('sg_user');
      set({ isLoading: false });
    }
  },
}));
