let websocketServer: Bun.Server<unknown> | undefined;

function chatTopic(chatId: string): string {
  return `chat:${chatId}`;
}

function setWebSocketServer(server: Bun.Server<unknown>): void {
  websocketServer = server;
}

function publishMessage(chatId: string, message: unknown): void {
  if (!websocketServer) return;

  websocketServer.publish(
    chatTopic(chatId),
    JSON.stringify({ channel: "message", data: message }),
  );
}

export { chatTopic, publishMessage, setWebSocketServer };
