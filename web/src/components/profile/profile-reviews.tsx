"use client";

import { SealCheckIcon, StarIcon } from "@phosphor-icons/react/dist/ssr";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReviews } from "@/hooks/use-reviews";
import { useUsers } from "@/hooks/use-profile";
import { ProfileReviewsSkeleton } from "@/components/skeleton/profile-reviews-skeleton";

function formatReviewDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function ProfileReviews({ username }: { username: string }) {
  const { data: usersData } = useUsers();
  const profile = usersData?.users.find((user) => user.username === username);
  const { data, isLoading } = useReviews(profile?.id ?? "");
  const reviews = data?.reviews ?? [];

  if (isLoading) return <ProfileReviewsSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <h2>Reviews</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[560px] overflow-y-auto">
        {reviews.length === 0 ? (
          <div className="space-y-2 py-4 text-center">
            <StarIcon
              size={24}
              className="mx-auto text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm font-medium">No reviews yet</p>
            <p className="text-sm text-muted-foreground">
              Reviews will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-5 pr-2">
            {reviews.map((review) => (
              <li key={review.id} className="  first:border-t-0 first:pt-0">
                <div className="flex items-center gap-2">
                  <Avatar>
                    <AvatarImage
                      src={review.reviewer.avatar}
                      alt={review.reviewer.name}
                    />
                    <AvatarFallback>
                      {review.reviewer.name
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate font-medium">
                      <span className="truncate">{review.reviewer.name}</span>
                      {review.reviewer.verified ? (
                        <SealCheckIcon
                          aria-label="Verified"
                          weight="fill"
                          className="size-4 shrink-0 text-sky-400"
                        />
                      ) : null}
                    </p>
                    <div className="flex items-center gap-3 text-sm">
                      <span
                        className="flex items-center gap-0.5 text-amber-400"
                        aria-label={`${review.rating} out of 5 stars`}
                      >
                        {Array.from({ length: 5 }, (_, index) => (
                          <StarIcon
                            key={index}
                            size={16}
                            weight={index < review.rating ? "fill" : "regular"}
                            aria-hidden="true"
                          />
                        ))}
                      </span>
                      <time
                        dateTime={review.createdAt}
                        className="text-muted-foreground"
                      >
                        {formatReviewDate(review.createdAt)}
                      </time>
                    </div>
                  </div>
                </div>
                <p className="mt-2 break-words text-md leading-relaxed text-muted-foreground">
                  {review.comment}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
