import { getVietnamDateRange, parseVietnamDateStart } from './date.util';

describe('Vietnam date parsing for trips and bookings', () => {
  it.each(['2026-10-01', '2024-02-29', '2026-12-31'])(
    'starts %s at midnight UTC+7 with an exclusive next-day boundary',
    (value) => {
      const range = getVietnamDateRange(value);
      expect(range.start).toEqual(new Date(`${value}T00:00:00+07:00`));
      expect(range.endExclusive.getTime() - range.start.getTime()).toBe(
        86400000,
      );
    },
  );

  it.each([
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '2026-01-00',
    '2026-1-1',
    'invalid',
  ])('rejects invalid calendar date %s', (value) =>
    expect(() => parseVietnamDateStart(value)).toThrow(),
  );
});
