import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  api,
  type AuthAxiosRequestConfig,
  type AuthStatus,
  getAccessToken,
  onAccessTokenChange,
  setAccessToken,
} from '../../../shared/api/api';
import { setupInterceptors } from '../../../shared/api/setupInterceptors';
import type { User } from '../types/user';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: { email: string; password: string; fullName?: string }) => Promise<string | undefined>;
  logout: () => void;
  refresh: () => Promise<string | null>;
  googleLogin: () => Promise<User>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const NO_AUTH_CONFIG: AuthAxiosRequestConfig = { skipAuth: true };

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessTokenState, setAccessTokenState] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('booting');

  const syncToken = useCallback((token: string | null) => {
    setAccessToken(token);
    setAccessTokenState(token);
  }, []);

  const logout = useCallback(() => {
    api.post('/auth/logout', {}, NO_AUTH_CONFIG).catch(() => {
    });
    syncToken(null);
    setUser(null);
    setStatus('guest');
  }, [syncToken]);

  const loadProfile = useCallback(async () => {
    const res = await api.get<User>('/auth/me');
    setUser(res.data);
    return res.data;
  }, []);

  const refreshToken = useCallback(async () => {
    const res = await api.post<{ accessToken: string | null }>('/auth/refresh', {}, NO_AUTH_CONFIG);
    const token = res.data?.accessToken ?? null;
    syncToken(token);
    return token;
  }, [syncToken]);

  useEffect(() => {
    const unsubscribe = onAccessTokenChange((token) => setAccessTokenState(token));
    setupInterceptors(getAccessToken, syncToken, logout);
    return () => {
      unsubscribe();
    };
  }, [logout, syncToken]);

  useEffect(() => {
    const bootstrap = async () => {
      setStatus('booting');
      try {
        const token = await refreshToken();
        if (token) {
          await loadProfile();
          setStatus('authed');
        } else {
          setStatus('guest');
        }
      } catch {
        logout();
      }
    };
    void bootstrap();
  }, [loadProfile, logout, refreshToken]);

  const login = async (email: string, password: string) => {
    setStatus('booting');
    const res = await api.post<{ user: User; accessToken: string }>(
      '/auth/login',
      { email, password },
      NO_AUTH_CONFIG,
    );
    syncToken(res.data.accessToken);
    setUser(res.data.user);
    setStatus('authed');
    return res.data.user;
  };

  const register = async (payload: { email: string; password: string; fullName?: string }) => {
    const res = await api.post<{ ok: boolean; message?: string }>(
      '/auth/register',
      payload,
      NO_AUTH_CONFIG,
    );
    return res.data.message;
  };

  const refresh = async () => {
    try {
      const token = await refreshToken();
      if (token) {
        await loadProfile();
        setStatus('authed');
      } else {
        setStatus('guest');
      }
      return token;
    } catch {
      logout();
      return null;
    }
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
        const data = event.data as { source?: string; payload?: { user: User; accessToken: string } };
        if (data?.source !== 'google-login' || !data.payload) return;
        window.clearTimeout(timer);
        window.removeEventListener('message', handler);
        try {
          if (popup && !popup.closed) popup.close();
        } catch {
        }
        syncToken(data.payload.accessToken);
        setUser(data.payload.user);
        setStatus('authed');
        resolve(data.payload.user);
      };

      window.addEventListener('message', handler);
    });
  };

  const value: AuthContextValue = {
    status,
    user,
    accessToken: accessTokenState,
    loading: status === 'booting',
    login,
    register,
    logout,
    refresh,
    googleLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};