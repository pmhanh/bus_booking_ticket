import axios, { type AxiosRequestConfig } from 'axios';
import { getErrorMessage } from '../utils/errorMessage';
import { API_BASE_URL } from './config';

export type AuthStatus = 'booting' | 'authed' | 'guest' | 'error';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

let accessToken: string | null = null;

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export async function apiClient<T = unknown>(
  path: string,
  options: AxiosRequestConfig & { body?: unknown } = {},
): Promise<T> {
  const { skipAuth, body, data, headers, ...rest } = options;
  const payload = data ?? body;
  const mergedHeaders: Record<string, string> = {
    ...(payload instanceof FormData
      ? {}
      : { 'Content-Type': 'application/json' }),
    ...(headers as Record<string, string>),
  };

  try {
    const config: AxiosRequestConfig = {
      url: path,
      method: rest.method ?? 'GET',
      data: payload,
      headers: mergedHeaders,
      skipAuth,
      ...rest,
    };

    const res = await api.request<T>(config);
    return res.data;
  } catch (error) {
    if (error instanceof Error && !axios.isAxiosError(error)) throw error;
    throw new Error(getErrorMessage(error));
  }
}
