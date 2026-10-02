import axios, { CanceledError } from 'axios';
import { api, getAccessToken, setAccessToken, type AuthStatus } from './api';
import type { User } from '../../features/auth/types/user';

type Session = {
  status: AuthStatus;
  user: User | null;
  accessToken: string | null;
  error: string | null;
};

const noAuth = { skipAuth: true };
let session: Session = { status: 'booting', user: null, accessToken: null, error: null };
let revision = 0;
let refreshPromise: Promise<string> | null = null;
let restorePromise: Promise<void> | null = null;
let mutationPromise: Promise<unknown> | null = null;
let retryLogout = false;
const listeners = new Set<() => void>();

export const getSession = () => session;
export const getSessionRevision = () => revision;
export const subscribeSession = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

function publish(patch: Partial<Session>) {
  session = { ...session, ...patch };
  setAccessToken(session.accessToken);
  listeners.forEach((listener) => listener());
}

function assertCurrent(expected: number) {
  if (expected !== revision) throw new CanceledError('Phiên đăng nhập đã thay đổi.');
}

export const isUnauthorized = (error: unknown) =>
  axios.isAxiosError(error) && error.response?.status === 401;

export function expireSession(expected = revision) {
  if (expected !== revision) return;
  revision += 1;
  publish({ status: 'guest', user: null, accessToken: null, error: null });
}

// Bootstrap and all 401 handlers share this request. Refresh tokens are single-use.
export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  if (mutationPromise) return Promise.reject(new CanceledError('Phiên đăng nhập đang thay đổi.'));
  const expected = revision;
  const pending = api.post<{ accessToken: string }>('/auth/refresh', {}, noAuth)
    .then(({ data }) => {
      assertCurrent(expected);
      if (!data.accessToken) throw new Error('Phản hồi khôi phục phiên không hợp lệ.');
      publish({ accessToken: data.accessToken });
      return data.accessToken;
    })
    .finally(() => {
      if (refreshPromise === pending) refreshPromise = null;
    });
  refreshPromise = pending;
  return pending;
}

export async function reloadProfile(): Promise<void> {
  const expected = revision;
  const { data } = await api.get<User>('/users/me');
  assertCurrent(expected);
  publish({ user: data });
}

export function restoreSession(): Promise<void> {
  if (restorePromise) return restorePromise;
  if (mutationPromise) return Promise.resolve();
  const expected = revision;
  publish({ status: 'booting', error: null });
  const pending = (async () => {
    try {
      // Keep a refreshed token when only the profile request failed temporarily.
      if (!getAccessToken()) await refreshAccessToken();
      assertCurrent(expected);
      await reloadProfile();
      assertCurrent(expected);
      publish({ status: 'authed', error: null });
    } catch (error) {
      if (expected !== revision || axios.isCancel(error)) return;
      if (isUnauthorized(error)) expireSession(expected);
      else publish({ status: 'error', error: 'Không thể kết nối để khôi phục phiên đăng nhập. Vui lòng thử lại.' });
    }
  })().finally(() => {
    if (restorePromise === pending) restorePromise = null;
  });
  restorePromise = pending;
  return pending;
}

// Serialize cookie-changing operations so a late refresh cannot undo logout/login.
function changeSession<T>(action: (expected: number) => Promise<T>): Promise<T> {
  const expected = ++revision;
  const previous = mutationPromise;
  const refreshing = refreshPromise;
  const pending = (async () => {
    await previous?.catch(() => undefined);
    await refreshing?.catch(() => undefined);
    assertCurrent(expected);
    return action(expected);
  })().finally(() => {
    if (mutationPromise === pending) mutationPromise = null;
  });
  mutationPromise = pending;
  return pending;
}

export function loginSession(email: string, password: string): Promise<User> {
  retryLogout = false;
  return changeSession(async (expected) => {
    const { data } = await api.post<{ user: User; accessToken: string }>(
      '/auth/login', { email, password }, noAuth,
    );
    assertCurrent(expected);
    publish({ status: 'authed', user: data.user, accessToken: data.accessToken, error: null });
    return data.user;
  });
}

export function logoutSession(): Promise<void> {
  retryLogout = true;
  publish({ status: 'booting', user: null, accessToken: null, error: null });
  return changeSession(async (expected) => {
    try {
      await api.post('/auth/logout', {}, noAuth);
      assertCurrent(expected);
      retryLogout = false;
      publish({ status: 'guest', error: null });
    } catch (error) {
      if (expected !== revision || axios.isCancel(error)) return;
      publish({ status: 'error', error: 'Chưa thể kết thúc phiên đăng nhập trên máy chủ. Vui lòng thử đăng xuất lại.' });
    }
  });
}

export const retrySession = () => retryLogout ? logoutSession() : restoreSession();
