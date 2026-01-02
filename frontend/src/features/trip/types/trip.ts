import type { Bus } from '../../bus/types/bus';
import type { Route } from '../../route/types/route';

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
