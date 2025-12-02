import type { City } from './city';

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
