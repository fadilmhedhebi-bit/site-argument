import { create } from 'zustand';
import { api, setApiToken } from '../utils/api';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,

  login: async (username, password) => {
    const data = await api.post('/auth/login', { username, password });
    setApiToken(data.token);
    set({ user: data.user, token: data.token });
    return data;
  },

  register: async (payload) => {
    const data = await api.post('/auth/register', payload);
    setApiToken(data.token);
    set({ user: data.user, token: data.token });
    return data;
  },

  logout: () => {
    setApiToken(null);
    set({ user: null, token: null });
  },

  setToken: (token) => {
    setApiToken(token);
    set({ token });
  },

  updateUser: (updates) => set((s) => ({ user: { ...s.user, ...updates } })),
}));
