import { Trip, TripStatus } from './trip.entity';
import { getRealTripStatus } from './trip-status.util';

export function checkInBlockedReason(
  trip: Pick<Trip, 'status' | 'departureTime' | 'arrivalTime'>,
  now = new Date(),
): string | null {
  const status = getRealTripStatus(trip, now);
  if (status === TripStatus.CANCELLED) return 'Chuyến xe đã bị hủy.';
  if (status === TripStatus.COMPLETED) return 'Chuyến xe đã hoàn thành.';
  const day = (date: Date) =>
    Math.floor((date.getTime() + 7 * 60 * 60 * 1000) / 86400000);
  if (day(now) > day(trip.departureTime))
    return 'Đã qua ngày khởi hành theo giờ Việt Nam.';
  if (status === TripStatus.IN_PROGRESS) return 'Chuyến xe đã khởi hành.';
  return null;
}
