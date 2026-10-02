export const formatDuration = (minutes?: number) => {
  if (!minutes && minutes !== 0) return '';
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
};
