import type { Trip } from '../../trip/types/trip';

export type SeatStatus = 'available' | 'inactive' | 'held' | 'booked';
export type SeatDefinition = {
  id: number;
  code: string;
  row: number;
  col: number;
  isActive: boolean;
};

export type SeatMap = {
  id: number;
  name: string;
  rows: number;
  cols: number;
  seats: SeatDefinition[];
  busCount?: number;
};

export type SeatWithState = SeatDefinition & {
  status: SeatStatus;
  expiresAt?: string | null;
  price?: number;
};

export type SeatAvailability = {
  trip: Trip;
  seatMap: Pick<SeatMap, 'id' | 'name' | 'rows' | 'cols'>;
  seats: SeatWithState[];
};
