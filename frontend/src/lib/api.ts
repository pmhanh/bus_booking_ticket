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
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { message?: string | string[] };
      const msg = Array.isArray(json.message) ? json.message.join(', ') : json.message || text;
      throw new Error(msg);
    } catch {
      throw new Error(text || res.statusText);
    }
  }
  return res.json() as Promise<T>;
}
