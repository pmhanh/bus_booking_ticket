export type Review = {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  user: { id: string; fullName?: string; email?: string };
};

export type TripReviewsResponse = {
  items: Review[];
  avgRating: number;
  count: number;
};
