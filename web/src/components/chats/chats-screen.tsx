"use client";

import { useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ChatComposer,
  type ChatAttachment,
} from "@/components/chats/chat-composer";
import { ChatMessages } from "@/components/chats/chat-messages";
import {
  ConversationList,
  type Conversation,
} from "@/components/chats/conversation-list";
import { cn } from "@/lib/utils";

const initialConversations: Conversation[] = [
  {
    id: "olivia",
    name: "Olivia Rhye",
    initials: "OR",
    unread: 0,
    messages: [
      {
        id: "olivia-1",
        text: "Hey! Have you had a chance to look at the updated dashboard?",
        outgoing: false,
        time: "10:24 AM",
      },
      {
        id: "olivia-2",
        text: "Yes, the token watchlist is looking good. I’m checking the transaction history next.",
        outgoing: true,
        time: "10:26 AM",
      },
      {
        id: "olivia-3",
        text: "Perfect. Let me know what you think when you’ve had a look.",
        outgoing: false,
        time: "10:28 AM",
      },
    ],
  },
  {
    id: "phoenix",
    name: "Phoenix Baker",
    initials: "PB",
    unread: 2,
    messages: [
      {
        id: "phoenix-1",
        text: "Hey, are you free to catch up this afternoon?",
        outgoing: false,
        time: "9:41 AM",
      },
      {
        id: "phoenix-2",
        text: "I have a few ideas for the earnings screen.",
        outgoing: false,
        time: "9:42 AM",
      },
    ],
  },
  {
    id: "lana",
    name: "Lana Steiner",
    initials: "LS",
    unread: 0,
    messages: [
      {
        id: "lana-1",
        text: "Thanks for sharing the update!",
        outgoing: false,
        time: "9:15 AM",
      },
      {
        id: "lana-2",
        text: "Of course. I’ll send the next version over once it’s ready.",
        outgoing: true,
        time: "9:18 AM",
      },
    ],
  },
  {
    id: "demi",
    name: "Demi Wilkinson",
    initials: "DW",
    unread: 1,
    messages: [
      {
        id: "demi-1",
        text: "Let’s review the new screens together tomorrow.",
        outgoing: false,
        time: "8:52 AM",
      },
    ],
  },
];

export function ChatsScreen() {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState(initialConversations[0].id);
  const [showThread, setShowThread] = useState(false);
  const selected = conversations.find(
    (conversation) => conversation.id === selectedId,
  )!;

  function selectConversation(id: string) {
    setSelectedId(id);
    setShowThread(true);
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === id ? { ...conversation, unread: 0 } : conversation,
      ),
    );
  }

  function sendMessage(text: string, attachments: ChatAttachment[]) {
    const message = {
      id: crypto.randomUUID(),
      text,
      attachments,
      outgoing: true,
      time: new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date()),
    };
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedId
          ? { ...conversation, messages: [...conversation.messages, message] }
          : conversation,
      ),
    );
  }

  return (
    <main className="h-svh min-h-0">
      <Card className="grid h-full min-h-0 gap-0 rounded-none py-0 md:grid-cols-[18rem_minmax(0,1fr)]">
        <aside
          className={cn(
            "min-h-0 flex-col bg-card/60 md:flex md:border-r md:border-white/5",
            showThread ? "hidden" : "flex",
          )}
        >
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={selectConversation}
          />
        </aside>
        <section
          aria-label={`Chat with ${selected.name}`}
          className={cn(
            "min-h-0 min-w-0 flex-col bg-background md:flex",
            showThread ? "flex" : "hidden",
          )}
        >
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/5 bg-card/60 px-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Back to conversations"
              onClick={() => setShowThread(false)}
            >
              <ArrowLeftIcon aria-hidden="true" />
            </Button>
            <Avatar>
              <AvatarFallback className="bg-muted text-foreground">{selected.initials}</AvatarFallback>
            </Avatar>
            <h2 className="min-w-0 flex-1 truncate font-medium">
              {selected.name}
            </h2>
            <Badge variant="outline" className="border-white/10 text-muted-foreground">Demo chat</Badge>
          </header>
          <div className="min-h-0 flex-1">
            <ChatMessages
              key={selected.id}
              messages={selected.messages}
              name={selected.name}
              initials={selected.initials}
            />
          </div>
          <ChatComposer key={selected.id} onSend={sendMessage} />
        </section>
      </Card>
    </main>
  );
}
