import type { SeatMap } from '../../seatmap/types/seatMap';

export type Bus = {
  id: number;
  name: string;
  plateNumber: string;
  busType?: string;
  amenities?: string[];
  photos?: string[];
  seatMap?: SeatMap | null;
};
