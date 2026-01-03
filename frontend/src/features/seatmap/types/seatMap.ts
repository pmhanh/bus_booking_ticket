import type { Route } from '../../route/types/route';
import type { Bus } from '../../bus/types/bus';

export type SeatStatus = 'available' | 'inactive' | 'held' | 'booked';

export type SeatDefinition = {
  id: number;
  code: string;
  row: number;
  col: number;
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
  expiresAt?: string | null;
  price?: number;
};

export type SeatAvailability = {
  trip: {
    id: number;
    basePrice: number;
    departureTime: string;
    arrivalTime: string;
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    route: Route;
    bus: Bus;
  };
  seatMap: Pick<SeatMap, 'id' | 'name' | 'rows' | 'cols'>;
  seats: SeatWithState[];
};
