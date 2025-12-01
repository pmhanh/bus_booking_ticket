const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function apiClient<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers as HeadersInit);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || res.statusText);
  }
  return res.json() as Promise<T>;
}
