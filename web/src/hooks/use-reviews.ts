"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import {
  createReview,
  getReviews,
  updateReview,
  type CreateReviewInput,
  type Review,
  type ReviewsResponse,
  type UpdateReviewInput,
} from "@/utils/api/reviews";

export const reviewsQueryKey = (reviewedUserId: string) =>
  ["reviews", reviewedUserId] as const;

function missingTokenError() {
  return new Error("Your session is unavailable. Please try again.");
}

export function useReviews(
  reviewedUserId: string,
  options?: Omit<
    UseQueryOptions<ReviewsResponse, Error>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    ...options,
    queryKey: reviewsQueryKey(reviewedUserId),
    queryFn: () => getReviews(reviewedUserId),
    enabled: Boolean(reviewedUserId) && (options?.enabled ?? true),
  });
}

export function useCreateReview(
  options?: Omit<
    UseMutationOptions<Review, Error, CreateReviewInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  const { getAccessToken } = usePrivy();

  return useMutation({
    ...options,
    mutationFn: async (input: CreateReviewInput) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw missingTokenError();
      return createReview(accessToken, input);
    },
    onSuccess: async (review, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({
        queryKey: reviewsQueryKey(variables.reviewedUserId),
      });
      await options?.onSuccess?.(review, variables, onMutateResult, context);
    },
  });
}

export function useUpdateReview(
  options?: Omit<
    UseMutationOptions<Review, Error, { reviewId: string; input: UpdateReviewInput }>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  const { getAccessToken } = usePrivy();

  return useMutation({
    ...options,
    mutationFn: async ({ reviewId, input }) => {
      const accessToken = await getAccessToken();
      if (!accessToken) throw missingTokenError();
      return updateReview(accessToken, reviewId, input);
    },
    onSuccess: async (review, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({
        queryKey: reviewsQueryKey(review.reviewedUserId),
      });
      await options?.onSuccess?.(review, variables, onMutateResult, context);
    },
  });
}
