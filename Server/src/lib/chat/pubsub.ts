import type { ChatSocketData } from "./realtime";

let chatServer: Bun.Server<ChatSocketData> | null = null;

export function setChatServer(server: Bun.Server<ChatSocketData>) {
  chatServer = server;
}

export function getChatTopic(chatId: string) {
  return `chat:${chatId}`;
}

export function publishChatEvent(chatId: string, payload: unknown) {
  chatServer?.publish(getChatTopic(chatId), JSON.stringify(payload));
}