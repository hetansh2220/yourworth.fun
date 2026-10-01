"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import {
  chatsApi,
  type ChatMessage,
  type ChatSocketEvent,
  type MessagesResponse,
} from "@/api/chats";
import { requireAccessToken } from "@/hooks/users/require-access-token";
import { chatKeys } from "./chat-keys";

type SocketStatus = "idle" | "connecting" | "open" | "closed" | "error";

type UseChatSocketOptions = {
  enabled?: boolean;
  onEvent?: (event: ChatSocketEvent) => void;
  onTypingStart?: (userId: string) => void;
  onTypingStop?: (userId: string) => void;
};

function updateMessagePages(
  data: InfiniteData<MessagesResponse, unknown> | undefined,
  message: ChatMessage | null,
  mode: "insert" | "replace"
) {
  if (!data || !message) {
    return data;
  }

  let found = false;
  const pages = data.pages.map((page) => {
    const messageExists = page.messages.some((item) => item.id === message.id);

    if (!messageExists) {
      return page;
    }

    found = true;
    return {
      ...page,
      messages: page.messages.map((item) =>
        item.id === message.id ? message : item
      ),
    };
  });

  if (!found && mode === "insert" && pages.length > 0) {
    const lastPage = pages.at(-1);

    if (lastPage) {
      pages[pages.length - 1] = {
        ...lastPage,
        messages: [...lastPage.messages, message],
        newerCursor: message.createdAt,
      };
    }
  }

  return {
    ...data,
    pages,
  };
}

export function useChatSocket(
  chatId: string,
  { enabled = true, onEvent, onTypingStart, onTypingStop }: UseChatSocketOptions = {}
) {
  const queryClient = useQueryClient();
  const { ready, authenticated, getAccessToken } = usePrivy();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const [status, setStatus] = useState<SocketStatus>("idle");

  useEffect(() => {
    if (!enabled || !ready || !authenticated || !chatId) {
      return;
    }

    let closedByHook = false;

    async function connect() {
      setStatus("connecting");

      try {
        const token = await requireAccessToken(getAccessToken);
        const socket = new WebSocket(chatsApi.getWebSocketUrl(chatId), [
          `privy-token.${token}`,
        ]);

        socketRef.current = socket;

        socket.onopen = () => {
          reconnectAttemptRef.current = 0;
          setStatus("open");
          void queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
          void queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
          void queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
        };

        socket.onmessage = (event) => {
          const payload = JSON.parse(event.data) as ChatSocketEvent;
          onEvent?.(payload);

          if (payload.type === "message.created") {
            queryClient.setQueryData<InfiniteData<MessagesResponse, unknown>>(
              chatKeys.messages(chatId),
              (data) => updateMessagePages(data, payload.message, "insert")
            );
            void queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
          }

          if (payload.type === "message.updated" || payload.type === "message.deleted") {
            queryClient.setQueryData<InfiniteData<MessagesResponse, unknown>>(
              chatKeys.messages(chatId),
              (data) => updateMessagePages(data, payload.message, "replace")
            );
          }

          if (payload.type === "chat.read") {
            void queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
            void queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
          }

          if (payload.type === "typing.start") {
            onTypingStart?.(payload.userId);
          }

          if (payload.type === "typing.stop") {
            onTypingStop?.(payload.userId);
          }
        };

        socket.onerror = () => {
          setStatus("error");
        };

        socket.onclose = () => {
          socketRef.current = null;
          setStatus("closed");

          if (closedByHook) {
            return;
          }

          const attempt = reconnectAttemptRef.current;
          const delay = Math.min(1000 * 2 ** attempt, 10_000);
          reconnectAttemptRef.current = attempt + 1;

          reconnectTimerRef.current = setTimeout(() => {
            void connect();
          }, delay);
        };
      } catch {
        setStatus("error");
      }
    }

    void connect();

    return () => {
      closedByHook = true;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [
    authenticated,
    chatId,
    enabled,
    getAccessToken,
    onEvent,
    onTypingStart,
    onTypingStop,
    queryClient,
    ready,
  ]);

  const sendEvent = useCallback((event: object) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }

    socketRef.current.send(JSON.stringify(event));
    return true;
  }, []);

  return {
    status,
    sendMessage: (content: string) => sendEvent({ type: "message", content }),
    editMessage: (messageId: string, content: string) =>
      sendEvent({ type: "message.edit", messageId, content }),
    deleteMessage: (messageId: string) =>
      sendEvent({ type: "message.delete", messageId }),
    startTyping: () => sendEvent({ type: "typing.start" }),
    stopTyping: () => sendEvent({ type: "typing.stop" }),
  };
}
