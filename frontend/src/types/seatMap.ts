export type SeatDefinition = {
  id: number;
  code: string;
  row: number;
  col: number;
  price: number;
  isActive: boolean;
};

export type SeatMap = {
  id: number;
  name: string;
  rows: number;
  cols: number;
  seats: SeatDefinition[];
};
