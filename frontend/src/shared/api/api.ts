import axios, { type AxiosRequestConfig } from 'axios';

export type AuthStatus = 'booting' | 'authed' | 'guest';

export type AuthAxiosRequestConfig = AxiosRequestConfig & {
  skipAuth?: boolean;
  _retry?: boolean;
};

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

let accessToken: string | null = null;
const tokenListeners = new Set<(token: string | null) => void>();

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  tokenListeners.forEach((fn) => fn(token));
};

export const onAccessTokenChange = (listener: (token: string | null) => void) => {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
};

const parseAxiosError = (error: unknown) => {
  if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data as { message?: string | string[] } | string | undefined;
    if (data && typeof data === 'object' && 'message' in data) {
      const message = Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message || error.message;
      return new Error(message);
    }
    if (typeof data === 'string') return new Error(data);
  }
  return error instanceof Error ? error : new Error('Unexpected error');
};

export async function apiClient<T = unknown>(
  path: string,
  options: AuthAxiosRequestConfig & { body?: unknown } = {},
): Promise<T> {
  const { skipAuth, body, data, headers, ...rest } = options;
  const payload = data ?? body;
  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  try {
    const config: AuthAxiosRequestConfig = {
      url: path,
      method: (rest.method as AuthAxiosRequestConfig['method']) ?? 'GET',
      data: payload,
      headers: mergedHeaders,
      skipAuth,
      ...rest,
    };

    const res = await api.request<T>(config);
    return res.data;
  } catch (error) {
    throw parseAxiosError(error);
  }
}
