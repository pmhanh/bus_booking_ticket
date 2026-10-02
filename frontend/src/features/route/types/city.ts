export type City = {
  id: number;
  name: string;
  slug: string;
  code: number;
};

export type CityListResponse = {
  data: City[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
