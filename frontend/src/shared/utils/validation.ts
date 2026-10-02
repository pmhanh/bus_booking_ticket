const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value: string) => EMAIL_PATTERN.test(value.trim());

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return 'Vui lòng nhập email';
  if (!isValidEmail(value)) return 'Email không đúng định dạng';
  return undefined;
}
