import { create } from 'zustand';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
}

interface AppState {
  user: User | null;
  token: string | null;
  initialized: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  init: () => void;
}

export const useApp = create<AppState>((set) => ({
  user: null,
  token: null,
  initialized: false,
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
  init: () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    // Validate token: must be a non-empty string starting with JWT header prefix
    const validToken = typeof token === 'string' && token.length > 0 && token.startsWith('eyJ');
    if (!validToken) {
      localStorage.removeItem('token');
    }

    // Validate user: must parse to an object with role === 'user'
    let validUser = false;
    let parsedUser: User | null = null;
    if (userStr) {
      try {
        parsedUser = JSON.parse(userStr);
        if (parsedUser && typeof parsedUser === 'object' && parsedUser.role === 'user') {
          validUser = true;
        }
      } catch {
        // parse failed, userStr is invalid
      }
    }
    if (!validUser) {
      localStorage.removeItem('user');
      parsedUser = null;
    }

    if (validToken && validUser) {
      set({ token, user: parsedUser, initialized: true });
    } else {
      set({ token: null, user: null, initialized: true });
    }
  },
}));
