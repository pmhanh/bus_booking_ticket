import type { Bus } from './bus';
import type { Route } from './route';

export type Trip = {
  id: number;
  route: Route;
  bus: Bus;
  departureTime: string;
  arrivalTime: string;
  basePrice: number;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
  durationMinutes?: number;
};
