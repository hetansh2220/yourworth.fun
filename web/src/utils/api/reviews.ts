import { api } from "@/lib/api";

export type Review = {
  id: string;
  reviewedUserId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  reviewer: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    verified: boolean;
  };
};

export type CreateReviewInput = {
  reviewedUserId: string;
  rating: number;
  comment?: string | null;
};

export type UpdateReviewInput = {
  rating?: number;
  comment?: string | null;
};

export type ReviewsResponse = {
  reviews: Review[];
  nextOffset: number | null;
};

export async function getReviews(
  reviewedUserId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<ReviewsResponse> {
  const params = new URLSearchParams({ reviewedUserId });
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) params.set("offset", String(options.offset));

  return api<ReviewsResponse>(`/reviews?${params.toString()}`);
}

export async function createReview(
  accessToken: string,
  input: CreateReviewInput,
): Promise<Review> {
  const response = await api<{ review: Review }>("/reviews", {
    method: "POST",
    accessToken,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.review;
}

export async function updateReview(
  accessToken: string,
  reviewId: string,
  input: UpdateReviewInput,
): Promise<Review> {
  const response = await api<{ review: Review }>(
    `/reviews/${encodeURIComponent(reviewId)}`,
    {
      method: "PATCH",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return response.review;
}
