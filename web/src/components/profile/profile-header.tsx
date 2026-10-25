import { SealCheckIcon } from "@phosphor-icons/react/dist/ssr";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ProfileActions } from "@/components/profile/profile-actions";
import { ProfileStats } from "@/components/profile/profile-stats";

type ProfileHeaderProps = {
  username: string;
  name?: string;
  imageSrc?: string;
  bio?: string;
  verified?: boolean;
  category?: string;
  rating?: number;
  reviewCount?: number;
  responseRate?: number;
  contractAddress?: string;
  xUsername?: string;
  reviewedUserId?: string;
};

export function ProfileHeader({
  username,
  name = username,
  imageSrc = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1364&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  bio = "Profile details coming soon.",
  verified = false,
  category,
  rating,
  reviewCount,
  responseRate,
  contractAddress,
  xUsername,
  reviewedUserId,
}: ProfileHeaderProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <section
      aria-labelledby="profile-name"
      className="flex flex-col gap-6 sm:flex-row sm:gap-8"
    >
      <Avatar className="size-32 rounded-xl after:rounded-xl sm:size-40 lg:size-48">
        <AvatarImage src={imageSrc} alt={name} className="rounded-xl" />
        <AvatarFallback className="rounded-xl text-4xl">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-2 sm:py-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="profile-name"
            className="break-words text-[32px] font-medium tracking-tight"
          >
            {name}
          </h1>
          {verified && (
            <span role="img" aria-label="Verified" className="text-primary">
              <SealCheckIcon size={28} weight="fill" aria-hidden="true" />
            </span>
          )}
          {category && (
            <Badge
              variant="secondary"
              className="h-auto rounded-full px-3 py-1 text-sm text-muted-foreground"
            >
              {category}
            </Badge>
          )}
        </div>
        <p className="text-base leading-relaxed text-muted-foreground">{bio}</p>
        <ProfileStats
          rating={rating}
          reviewCount={reviewCount}
          responseRate={responseRate}
        />
        <ProfileActions
          contractAddress={contractAddress}
          xUsername={xUsername}
          reviewedUserId={reviewedUserId}
          name={name}
          avatar={imageSrc}
        />
      </div>
    </section>
  );
}
