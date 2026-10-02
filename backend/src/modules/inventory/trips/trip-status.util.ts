import { Trip, TripStatus } from './trip.entity';

type TripStatusSource = Pick<Trip, 'status' | 'departureTime' | 'arrivalTime'>;

export function getRealTripStatus(
  trip: TripStatusSource,
  now = new Date(),
): TripStatus {
  if (trip.status === TripStatus.CANCELLED || trip.status === TripStatus.COMPLETED) {
    return trip.status;
  }

  if (trip.arrivalTime <= now) {
    return TripStatus.COMPLETED;
  }

  if (
    (trip.status === TripStatus.SCHEDULED || trip.status === TripStatus.DELAYED) &&
    trip.departureTime <= now
  ) {
    return TripStatus.IN_PROGRESS;
  }

  return trip.status;
}
