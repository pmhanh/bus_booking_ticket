import { CanceledError, type AxiosError } from 'axios';
import { api, getAccessToken } from './api';
import { expireSession, getSessionRevision, isUnauthorized, refreshAccessToken } from './authSession';

export function setupInterceptors() {
  const requestId = api.interceptors.request.use((config) => {
    if (config.skipAuth) return config;
    if (config._authRevision !== undefined && config._authRevision !== getSessionRevision()) {
      throw new CanceledError('Phiên đăng nhập đã thay đổi.');
    }
    config._authRevision = getSessionRevision();
    const token = getAccessToken();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    else config.headers.delete('Authorization');
    return config;
  });

  const responseId = api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const original = error.config;
      if (!original || original.skipAuth || !isUnauthorized(error)) throw error;
      const expected = original._authRevision;
      if (expected !== getSessionRevision()) throw error;
      // Guest requests must not start a refresh loop.
      const token = getAccessToken();
      if (!token) throw error;
      if (original._retry) {
        expireSession(expected);
        throw error;
      }
      original._retry = true;
      try {
        // A delayed 401 can belong to a token that another request already replaced.
        if (original.headers.get('Authorization') === `Bearer ${token}`) {
          await refreshAccessToken();
        }
      } catch (refreshError) {
        if (isUnauthorized(refreshError)) expireSession(expected);
        throw refreshError;
      }
      if (expected !== getSessionRevision()) throw new CanceledError('Phiên đăng nhập đã thay đổi.');
      return api.request(original);
    },
  );

  return () => {
    api.interceptors.request.eject(requestId);
    api.interceptors.response.eject(responseId);
  };
}
