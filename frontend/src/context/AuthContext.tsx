import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../lib/api';
import type { User } from '../types/user';

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<User>;
  register: (payload: { email: string; password: string; fullName?: string }) => Promise<string | undefined>;
  logout: () => void;
  refresh: () => Promise<void>;
  googleLogin: () => Promise<User>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'bus_tokens';

type TokenBundle = { accessToken: string; refreshToken: string; userId: string };

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const persistTokens = (bundle: TokenBundle | null) => {
    if (!bundle) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setAccessToken(null);
      return;
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(bundle));
    setAccessToken(bundle.accessToken);
  };

  const loadProfile = async (tokenBundle: TokenBundle) => {
    const me = await apiClient<User>('/auth/me', {
      headers: { Authorization: `Bearer ${tokenBundle.accessToken}` },
    });
    setUser(me);
  };

  useEffect(() => {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) {
      setLoading(false);
      return;
    }
    const stored = JSON.parse(raw) as TokenBundle;
    setAccessToken(stored.accessToken);
    loadProfile(stored)
      .catch(() => persistTokens(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string, remember?: boolean) => {
    setLoading(true);
    const res = await apiClient<{ user: User; tokens: TokenBundle }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, remember }),
    });
    const bundle = {
      accessToken: res.tokens.accessToken,
      refreshToken: res.tokens.refreshToken,
      userId: res.user.id,
    };
    if (remember) persistTokens(bundle);
    setAccessToken(bundle.accessToken);
    setUser(res.user);
    setLoading(false);
    return res.user;
  };

  const register = async (payload: { email: string; password: string; fullName?: string }) => {
    setLoading(true);
    const res = await apiClient<{ ok: boolean; message?: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setLoading(false);
    return res.message;
  };

  const refresh = async () => {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw) as TokenBundle;
    const tokens = await apiClient<TokenBundle>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: stored.refreshToken, userId: stored.userId }),
    });
    persistTokens({ ...tokens, userId: stored.userId });
    await loadProfile({ ...tokens, userId: stored.userId });
  };

  const googleLogin = async () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const popup = window.open(
      `${apiBase}/auth/google/start`,
      'google-login',
      'width=500,height=700',
    );
    if (!popup) throw new Error('Popup blocked. Please allow popups for this site.');

    return new Promise<User>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        window.removeEventListener('message', handler);
        popup.close();
        reject(new Error('Google sign-in timed out.'));
      }, 120000);

      const handler = (event: MessageEvent) => {
        const data = event.data as { source?: string; payload?: { user: User; tokens: TokenBundle } };
        if (data?.source !== 'google-login' || !data.payload) return;
        window.clearTimeout(timer);
        window.removeEventListener('message', handler);
        try {
          if (popup && !popup.closed) popup.close();
        } catch {
          // ignore COOP warnings when closing cross-origin popup
        }
        const bundle = {
          accessToken: data.payload.tokens.accessToken,
          refreshToken: data.payload.tokens.refreshToken,
          userId: data.payload.user.id,
        };
        persistTokens(bundle);
        setUser(data.payload.user);
        resolve(data.payload.user);
      };

      window.addEventListener('message', handler);
    });
  };

  const logout = () => {
    persistTokens(null);
    setUser(null);
  };

  const value = { user, accessToken, loading, login, register, logout, refresh, googleLogin };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
