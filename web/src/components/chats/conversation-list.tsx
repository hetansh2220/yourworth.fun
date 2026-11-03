"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage } from "@/components/chats/chat-messages";
import { ConversationListSkeleton } from "@/components/skeleton/conversation-list-skeleton";

export type Conversation = {
  id: string;
  type: "DM" | "GROUP";
  name: string;
  initials: string;
  avatar?: string | null;
  unread: number;
  messages: ChatMessage[];
};

export function ConversationList({ conversations, selectedId, onSelect, loading = false }: {
  conversations: Conversation[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading?: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = conversations.filter((conversation) => conversation.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-white/5 px-4">
        <h1 className="text-lg font-semibold">Chats</h1>
      </div>
      <div className="p-4">
        <Input aria-label="Search conversations" placeholder="Search conversations…" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <nav aria-label="Conversations" className="min-h-0 flex-1 overflow-y-auto py-2">
        {loading ? <ConversationListSkeleton /> : (
          <>
        {filtered.map((conversation) => {
          const last = conversation.messages.at(-1);
          return (
            <Button key={conversation.id} variant="ghost" className="h-auto w-full justify-start gap-3 rounded-none border-0 px-3 py-4 text-left hover:bg-white/5 dark:hover:bg-white/5 aria-current:bg-muted" aria-current={selectedId === conversation.id ? "true" : undefined} onClick={() => onSelect(conversation.id)}>
              <Avatar>
                {conversation.avatar ? <AvatarImage src={conversation.avatar} alt="" /> : null}
                <AvatarFallback className={selectedId === conversation.id ? "bg-primary/20 text-foreground" : "bg-muted text-muted-foreground"}>{conversation.initials}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{conversation.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{last?.time}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">{last?.outgoing ? "You: " : ""}{last?.text || last?.attachments?.[0]?.name || "No messages yet"}</span>
                  {conversation.unread > 0 ? <Badge aria-label={`${conversation.unread} unread messages`}>{conversation.unread}</Badge> : null}
                </span>
              </span>
            </Button>
          );
        })}
        {filtered.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">No conversations found.</p> : null}
          </>
        )}
      </nav>
    </>
  );
}
