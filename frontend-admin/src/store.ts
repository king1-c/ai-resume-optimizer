import { create } from 'zustand';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin' | 'SUPER_ADMIN';
}

interface AppState {
  user: AdminUser | null;
  token: string | null;
  setAuth: (token: string, user: AdminUser) => void;
  logout: () => void;
  init: () => void;
}

export const useApp = create<AppState>((set) => ({
  user: null,
  token: null,
  setAuth: (token, user) => {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    set({ token: null, user: null });
  },
  init: () => {
    const token = localStorage.getItem('admin_token');
    const userStr = localStorage.getItem('admin_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === 'admin' || user.role === 'SUPER_ADMIN') set({ token, user });
        else {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
        }
      } catch {
        localStorage.removeItem('admin_user');
      }
    }
  },
}));
