import { SealCheckIcon } from "@phosphor-icons/react/dist/ssr";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ProfileCardProps = {
  name?: string;
  bio?: string;
  imageSrc?: string;
  verified?: boolean;
  minutePrice?: number;
  change24h?: number;
  className?: string;
};

export default function ProfileCard({
  name = "Sophie Bennett",
  bio = "Product Designer who focuses on simplicity & usability.",
  imageSrc = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1364&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  verified = false,
  minutePrice = 0.12,
  change24h = 0,
  className,
}: ProfileCardProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (
    <Card
      className={cn("w-full max-w-[240px] gap-3 rounded-xl p-1", className)}
    >
      <Avatar className="aspect-square size-auto w-full overflow-hidden rounded-[calc(var(--radius-xl)-4px)] after:rounded-[inherit]">
        <AvatarImage src={imageSrc} alt={name} className="rounded-[inherit]" />
        <AvatarFallback className="rounded-[inherit] text-5xl">
          {initials}
        </AvatarFallback>
      </Avatar>
      <CardContent className="space-y-3 p-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CardTitle className="truncate text-base">{name}</CardTitle>
            {verified && (
              <span
                className="shrink-0 text-primary"
                role="img"
                aria-label="Verified"
              >
                <SealCheckIcon size={16} weight="fill" aria-hidden="true" />
              </span>
            )}
          </div>
          <CardDescription className="line-clamp-2 text-sm leading-snug">
            {bio}
          </CardDescription>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm tabular-nums">
          <p aria-label={`Minute price: $${minutePrice.toFixed(2)}`}>
            <span className="font-medium">${minutePrice.toFixed(2)}</span>
            <span className="text-muted-foreground"> / min</span>
          </p>
          <p
            aria-label={`24-hour change: ${change24h.toFixed(2)}%`}
            className={cn(change24h < 0 ? "text-red-400" : "text-emerald-400")}
          >
            {change24h > 0 ? "+" : ""}
            {change24h.toFixed(2)}%
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
