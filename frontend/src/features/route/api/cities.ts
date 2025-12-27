import { apiClient } from '../../../shared/api/api';

export type CityOption = {
  id: number;
  name: string;
  code: number;
  slug: string;
};

export async function searchCities(query: string, limit = 10): Promise<CityOption[]> {
  const qs = new URLSearchParams();
  qs.set('q', query);
  qs.set('limit', String(limit));
  return apiClient<CityOption[]>(`/cities/search?${qs.toString()}`, { method: 'GET' });
}
