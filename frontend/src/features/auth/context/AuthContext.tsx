import { createContext, useContext, useEffect, useSyncExternalStore, type PropsWithChildren } from 'react';
import { api } from '../../../shared/api/api';
import {
  getSession, subscribeSession, restoreSession, retrySession,
  loginSession, logoutSession, reloadProfile,
} from '../../../shared/api/authSession';
import { setupInterceptors } from '../../../shared/api/setupInterceptors';
import { safeReturnTo } from '../utils/returnTo';

const register = async (payload: { email: string; password: string; fullName?: string }) => {
  const { data } = await api.post<{ message?: string }>('/auth/register', payload, { skipAuth: true });
  return data.message;
};

const googleLogin = (returnTo = '/') => {
  const url = new URL(`${api.defaults.baseURL}/auth/google`, window.location.origin);
  url.searchParams.set('returnTo', safeReturnTo(returnTo) ?? '/');
  window.location.assign(url.toString());
};

type AuthContextValue = ReturnType<typeof getSession> & {
  login: typeof loginSession;
  logout: typeof logoutSession;
  reloadProfile: typeof reloadProfile;
  retry: typeof retrySession;
  register: typeof register;
  googleLogin: typeof googleLogin;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const session = useSyncExternalStore(subscribeSession, getSession);
  useEffect(() => {
    const cleanup = setupInterceptors();
    void restoreSession();
    return cleanup;
  }, []);

  return (
    <AuthContext.Provider value={{
      ...session, login: loginSession, logout: logoutSession, reloadProfile,
      retry: retrySession, register, googleLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
