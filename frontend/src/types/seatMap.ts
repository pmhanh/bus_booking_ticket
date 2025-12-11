import type { Route } from './route';
import type { Bus } from './bus';

export type SeatStatus = 'available' | 'locked' | 'held' | 'inactive' | 'booked';

export type SeatDefinition = {
  id: number;
  code: string;
  row: number;
  col: number;
  price: number;
  isActive: boolean;
  seatType?: string;
};

export type SeatMap = {
  id: number;
  name: string;
  rows: number;
  cols: number;
  seats: SeatDefinition[];
};

export type SeatWithState = SeatDefinition & {
  status: SeatStatus;
  lockedUntil?: string;
  lockToken?: string;
};

export type SeatAvailability = {
  trip: {
    id: number;
    basePrice: number;
    departureTime: string;
    arrivalTime: string;
    status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
    route: Route;
    bus: Bus;
  };
  seatMap: Pick<SeatMap, 'id' | 'name' | 'rows' | 'cols'>;
  seats: SeatWithState[];
};
