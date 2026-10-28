"use client";

import { FileIcon } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import type { ChatAttachment } from "@/components/chats/chat-composer";

export type ChatMessage = {
  id: string;
  text: string;
  outgoing: boolean;
  time: string;
  senderName?: string;
  senderInitials?: string;
  senderAvatar?: string | null;
  attachments?: ChatAttachment[];
};

export function ChatMessages({
  messages,
  name,
  initials,
}: {
  messages: ChatMessage[];
  name: string;
  initials: string;
}) {
  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller>
        <MessageScrollerViewport aria-label={`Conversation with ${name}`}>
          <MessageScrollerContent className="p-4">
            {messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Start the conversation with a message.
              </p>
            ) : null}
            {messages.map((message) => (
              <MessageScrollerItem key={message.id} messageId={message.id}>
                <MessageGroup>
                  <Message align={message.outgoing ? "end" : "start"}>
                    <MessageAvatar>
                      <Avatar>
                        {message.senderAvatar ? (
                          <AvatarImage src={message.senderAvatar} alt="" />
                        ) : null}
                        <AvatarFallback
                          className={
                            message.outgoing
                              ? "bg-primary/15 text-foreground"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {message.outgoing
                            ? "You"
                            : (message.senderInitials ?? initials)}
                        </AvatarFallback>
                      </Avatar>
                    </MessageAvatar>
                    <MessageContent>
                      <MessageHeader>
                        {message.outgoing
                          ? "You"
                          : (message.senderName ?? name)}
                      </MessageHeader>
                      {message.text ? (
                        <Bubble
                          variant={message.outgoing ? "default" : "muted"}
                        >
                          <BubbleContent className="whitespace-pre-wrap border-white/5">
                            {message.text}
                          </BubbleContent>
                        </Bubble>
                      ) : null}
                      {message.attachments?.map((attachment) => (
                        <Attachment key={attachment.id}>
                          <AttachmentMedia>
                            <FileIcon aria-hidden="true" />
                          </AttachmentMedia>
                          <AttachmentContent>
                            <AttachmentTitle>{attachment.name}</AttachmentTitle>
                            <AttachmentDescription>
                              {Math.max(1, Math.ceil(attachment.size / 1024))}{" "}
                              KB · Local preview
                            </AttachmentDescription>
                          </AttachmentContent>
                        </Attachment>
                      ))}
                      <MessageFooter>
                        {message.time}
                        {message.outgoing}
                      </MessageFooter>
                    </MessageContent>
                  </Message>
                </MessageGroup>
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
