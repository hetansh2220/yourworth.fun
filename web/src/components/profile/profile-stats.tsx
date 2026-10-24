import { StarIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

export function ProfileStats({
  rating = 0,
  reviewCount = 0,
  responseRate,
}: {
  rating?: number;
  reviewCount?: number;
  responseRate?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
      <span
        className="flex items-center gap-1"
        aria-label={`${rating} out of 5 stars`}
      >
        {Array.from({ length: 5 }, (_, index) => (
          <StarIcon
            key={index}
            size={18}
            weight="fill"
            aria-hidden="true"
            className={cn(
              index < Math.round(rating)
                ? "text-foreground"
                : "text-muted-foreground/40",
            )}
          />
        ))}
        <span className="ml-1 tabular-nums">{rating}</span>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
      </span>
      {responseRate !== undefined && (
        <>
          <span aria-hidden="true">·</span>
          <span>{responseRate}% response rate</span>
        </>
      )}
    </div>
  );
}
