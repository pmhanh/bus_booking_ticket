export type City = {
  id: number;
  name: string;
  slug: string;
  country: string;
};

export type RouteStop = {
  id: number;
  city: City;
  type: 'PICKUP' | 'DROPOFF';
  order: number;
  estimatedOffsetMinutes: number;
};

export type Route = {
  id: number;
  name: string;
  originCity: City;
  destinationCity: City;
  estimatedDurationMinutes: number;
  stops?: RouteStop[];
};

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

export type Bus = {
  id: number;
  name: string;
  plateNumber: string;
  seatMap?: SeatMap | null;
};

export type Trip = {
  id: number;
  route: Route;
  bus: Bus;
  departureTime: string;
  arrivalTime: string;
  basePrice: number;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
};
