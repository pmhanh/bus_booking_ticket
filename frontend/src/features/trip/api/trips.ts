import { apiClient } from '../../../shared/api/api';
import type { Trip } from '../types/trip';

export type TripSearchParams = {
  originId?: number;
  destinationId?: number;
  date?: string;
  startTime?: string;
  endTime?: string;
  minPrice?: number;
  maxPrice?: number;
  busType?: string;
  amenities?: string[];
  sortBy?: 'price' | 'time' | 'duration';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

export type TripSearchResponse = {
  data: Trip[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function searchTrips(params: TripSearchParams): Promise<TripSearchResponse> {
  const qs = new URLSearchParams();
  const append = (key: string, value?: string | number | null) => {
    if (value === undefined || value === null || value === '') return;
    qs.set(key, String(value));
  };

  append('originId', params.originId);
  append('destinationId', params.destinationId);
  append('date', params.date);
  append('startTime', params.startTime);
  append('endTime', params.endTime);
  append('minPrice', params.minPrice);
  append('maxPrice', params.maxPrice);
  append('busType', params.busType);
  append('sortBy', params.sortBy);
  append('sortOrder', params.sortOrder);
  append('page', params.page);
  append('limit', params.limit);
  params.amenities?.forEach((a) => qs.append('amenities', a));

  return apiClient<TripSearchResponse>(`/trips/search?${qs.toString()}`, { method: 'GET' });
}

export async function getTripById(id: number) {
  return apiClient<Trip>(`/trips/${id}`, { method: 'GET' });
}
