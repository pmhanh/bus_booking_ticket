import { BadRequestException } from '@nestjs/common';

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const VIETNAM_UTC_OFFSET = '+07:00';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function parseVietnamDateStart(value: string): Date {
  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new BadRequestException('Invalid date. Use YYYY-MM-DD');
  }

  const [year, month, day] = value.split('-').map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const isValidCalendarDate =
    calendarDate.getUTCFullYear() === year &&
    calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day;

  if (!isValidCalendarDate) {
    throw new BadRequestException('Invalid calendar date');
  }

  return new Date(`${value}T00:00:00${VIETNAM_UTC_OFFSET}`);
}

export function getVietnamDateRange(value: string) {
  const start = parseVietnamDateStart(value);
  return {
    start,
    endExclusive: new Date(start.getTime() + DAY_IN_MS),
  };
}
