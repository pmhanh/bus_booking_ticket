import { apiClient } from '../../../shared/api/api';
import type { City, CityListResponse } from '../types/city';

export type CityOption = City;

export async function searchCities(
  query: string,
  limit = 10,
): Promise<CityOption[]> {
  const qs = new URLSearchParams();
  qs.set('q', query);
  qs.set('limit', String(limit));
  const response = await apiClient<CityListResponse>(
    `/cities?${qs.toString()}`,
    { method: 'GET' },
  );
  return response.data;
}
