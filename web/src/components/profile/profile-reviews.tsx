import { StarIcon } from "@phosphor-icons/react/dist/ssr";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProfileReview = {
  id: string;
  name: string;
  imageSrc?: string;
  rating: number;
  comment: string;
};

export function ProfileReviews({ reviews = [] }: { reviews?: ProfileReview[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <h2>Reviews</h2>
          <span className="text-sm font-normal text-muted-foreground">{reviews.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <div className="space-y-2 py-4 text-center">
            <StarIcon size={24} className="mx-auto text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">No reviews yet</p>
            <p className="text-sm text-muted-foreground">Reviews will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-5">
            {reviews.map((review) => (
              <li key={review.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar>
                    <AvatarImage src={review.imageSrc} alt={review.name} />
                    <AvatarFallback>{review.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate font-medium">{review.name}</span>
                  <span className="flex items-center gap-1 text-sm tabular-nums" aria-label={`${review.rating} out of 5 stars`}>
                    <StarIcon size={14} weight="fill" aria-hidden="true" />{review.rating}
                  </span>
                </div>
                <p className="break-words text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
