import type { AxiosError } from 'axios';
import { api, type AuthAxiosRequestConfig } from './api';

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

export function setupInterceptors(
  getToken: () => string | null,
  onTokenChange: (token: string | null) => void,
  logout: () => void,
) {
  api.interceptors.request.use((config) => {
    const cfg = config as AuthAxiosRequestConfig;
    if (cfg.skipAuth) return cfg as unknown as typeof config;

    const token = getToken();
    if (token) {
      const headers = (cfg.headers ?? {}) as Record<string, unknown>;
      if (!('Authorization' in headers)) {
        headers.Authorization = `Bearer ${token}`;
      }
      cfg.headers = headers as typeof cfg.headers;
    }
    return cfg as unknown as typeof config;
  });

  api.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const original = error.config as AuthAxiosRequestConfig & { _retry?: boolean };
      const status = error.response?.status;

      const url: string = original?.url || "";
      if (url.includes("/auth/refresh") || url.includes("/auth/logout")) {
      return Promise.reject(error);
    }

      if (!status || status !== 401 || !original) {
        return Promise.reject(error);
      }

      if (original._retry || (original.url ?? '').includes('/auth/refresh')) {
        logout();
        return Promise.reject(error);
      }
      original._retry = true;

      try {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = api
            .post<{ accessToken: string }>('/auth/refresh', {}, { skipAuth: true })
            .then((r) => {
              const newToken = r.data?.accessToken;
              onTokenChange(newToken ?? null);
              return newToken;
            })
            .finally(() => {
              isRefreshing = false;
              refreshPromise = null;
            });
        }

        const newToken = await refreshPromise!;
        if (!newToken) throw error;

        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (err) {
        logout();
        return Promise.reject(err);
      }
    },
  );
}
