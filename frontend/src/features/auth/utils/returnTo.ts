export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  if (/[\\\s]/.test(value)) return null;
  const url = new URL(value, 'https://app.invalid');
  if (url.origin !== 'https://app.invalid' || url.pathname === '/login') return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
