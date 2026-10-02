import axios from 'axios';

export function getErrorMessage(
  error: unknown,
  fallback = 'Đã xảy ra lỗi không mong muốn',
): string {
  if (axios.isAxiosError(error) && error.response) {
    const data: unknown = error.response.data;
    if (typeof data === 'string' && data) return data;
    if (data && typeof data === 'object' && 'message' in data) {
      const message = data.message;
      if (Array.isArray(message)) return message.join(', ') || fallback;
      if (typeof message === 'string' && message) return message;
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
