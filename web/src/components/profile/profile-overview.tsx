"use client";

import { DirectMessageDialog } from "@/components/dialogs/direct-message-dialog";
import { GroupChatDialog } from "@/components/dialogs/group-chat-dialog";
import type { ReactNode } from "react";
import { ChatCircleDotsIcon, ChatsTeardropIcon, ShieldCheckIcon } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useUsers } from "@/hooks/use-profile";

function AccessCard({ icon, title, description, children }: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0 p-1.5">
      <CardContent className="flex items-start gap-4 px-4 py-5 sm:items-center sm:gap-6 sm:p-6">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
          {icon}
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="text-lg font-medium">{title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </CardContent>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 px-4 py-4 text-sm">
        {children}
      </div>
    </Card>
  );
}

export function ProfileOverview({ username, minutePrice = 0.12, messagePrice = 10, requiredMinutes = 100, memberCount }: {
  username: string;
  minutePrice?: number;
  messagePrice?: number;
  requiredMinutes?: number;
  memberCount?: number;
}) {
  const { data } = useUsers();
  const profile = data?.users.find((user) => user.username === username);

  return (
    <section aria-labelledby="profile-overview-heading" className="space-y-4">
      <div className="space-y-2">
        <h2 id="profile-overview-heading" className="text-2xl font-medium">Get access to {username}</h2>
        <p className="text-base text-muted-foreground">Use your purchased minutes to connect with {username}</p>
      </div>
      <DirectMessageDialog userId={profile?.id ?? ""} username={username} creatorWalletAddress={profile?.walletAddress} minutePrice={minutePrice} messagePrice={messagePrice}>
      <AccessCard
        icon={<ChatCircleDotsIcon size={26} aria-hidden="true" />}
        title="Direct Message"
        description="Send a direct message for a quick connection. Keep the conversation going with additional messages if needed."
      >
        <p className="flex flex-wrap items-baseline gap-2 tabular-nums">
          <span className="text-muted-foreground">Price</span>
          <span className="font-medium">{minutePrice > 0 ? `${(messagePrice / minutePrice).toFixed(2)} min` : "—"}</span>
          <span className="text-muted-foreground">${messagePrice.toFixed(2)}</span>
        </p>
        <Badge variant="outline" className="h-auto rounded-full border-primary/30 px-3 py-1 text-primary">
          <ShieldCheckIcon aria-hidden="true" /> Refund if no response
        </Badge>
      </AccessCard>
      </DirectMessageDialog>
      <GroupChatDialog username={username} minutePrice={minutePrice} requiredMinutes={requiredMinutes}>
      <AccessCard
        icon={<ChatsTeardropIcon size={26} aria-hidden="true" />}
        title="Group Chat"
        description={`Join and connect with ${username} in an exclusive group chat with other users.`}
      >
        <p className="flex flex-wrap gap-2">
          <span className="text-muted-foreground">Price</span>
          <span className="font-medium">Free for holders of {requiredMinutes} minutes</span>
        </p>
        <p className="text-muted-foreground">Chat members <span className="ml-2 text-foreground tabular-nums">{memberCount ?? "—"}</span></p>
      </AccessCard>
      </GroupChatDialog>
    </section>
  );
}
