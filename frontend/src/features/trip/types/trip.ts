import type { Bus } from '../../bus/types/bus';
import type { Route } from '../../route/types/route';

export type TripStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DELAYED';

export type Trip = {
  id: number;
  route: Route;
  bus: Bus;
  departureTime: string;
  arrivalTime: string;
  basePrice: number;
  status: TripStatus;
  realStatus?: TripStatus;
  durationMinutes?: number;
};

export function getTripDisplayStatus(trip: Pick<Trip, 'status' | 'realStatus'>): TripStatus {
  return trip.realStatus ?? trip.status;
}
