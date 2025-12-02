import type { SeatMap } from './seatMap';

export type Bus = {
  id: number;
  name: string;
  plateNumber: string;
  busType?: string;
  amenities?: string[];
  seatMap?: SeatMap | null;
};
