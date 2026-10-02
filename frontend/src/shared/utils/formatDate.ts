export const formatTime = (value: string, timeZone?: string) =>
  new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });

export const formatDate = (value: string, timeZone?: string) =>
  new Date(value).toLocaleDateString('vi-VN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  });
