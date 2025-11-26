const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function apiClient<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || res.statusText);
  }
  return res.json() as Promise<T>;
}
