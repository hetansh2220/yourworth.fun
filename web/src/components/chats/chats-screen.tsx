"use client";

import { useState, useEffect } from "react";
import { ArrowLeftIcon, UsersIcon } from "@phosphor-icons/react";
import {
  useChatMembers,
  useChats,
  useMessages,
  useReplyDM,
} from "@/hooks/use-chats";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChatComposer } from "@/components/chats/chat-composer";
import {
  ChatMessages,
  type ChatMessage,
} from "@/components/chats/chat-messages";
import {
  ConversationList,
  type Conversation,
} from "@/components/chats/conversation-list";
import GrpMembersDialog from "@/components/dialogs/grp-members-dialog";
import { cn } from "@/lib/utils";
import { usePrivy } from "@privy-io/react-auth";
import { useRef } from "react";
import { useProfile } from "@/hooks/use-profile";
import { BN, web3, type Wallet } from "@coral-xyz/anchor";
import { releasePayment } from "@/utils/solana/orders";
import connection from "@/lib/connection";
import {
  useSignTransaction,
  useWallets as useSolanaWallets,
} from "@privy-io/react-auth/solana";

export function ChatsScreen() {
  const { data: chats = [], isLoading, isError } = useChats();
  useEffect(() => {
    console.log("Chats fetched from backend:", chats);
  }, [chats]);
  const conversations: Conversation[] = chats.map((chat) => ({
    id: chat.id,
    type: chat.type,
    name:
      chat.name ?? (chat.type === "GROUP" ? "Group chat" : "Direct message"),
    avatar: chat.avatar,
    initials: (
      chat.name ?? (chat.type === "GROUP" ? "Group chat" : "Direct message")
    )
      .slice(0, 2)
      .toUpperCase(),
    unread: 0,
    messages: [],
  }));
  const [selectedId, setSelectedId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showThread, setShowThread] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const { getAccessToken } = usePrivy();
  const { data: profile } = useProfile();
  const replyDM = useReplyDM();
  const { wallets } = useSolanaWallets();
  const activeId = selectedId ?? conversations[0]?.id;
  const selected = conversations.find((chat) => chat.id === activeId);
  const { data: chatMembers = [] } = useChatMembers(activeId);
  const { signTransaction } = useSignTransaction();

  const dialogMembers = chatMembers.map((member) => ({
    id: member.id,
    name: member.name,
    avatar: member.avatar,
    initials: member.name.slice(0, 2).toUpperCase(),
  }));
  const { data: messageResponse } = useMessages(activeId);
  const loadedMessages: ChatMessage[] = (messageResponse?.messages ?? []).map(
    (message) => ({
      id: message.id,
      text: message.content,
      outgoing: message.senderId === profile?.id,
      senderName: message.sender.name,
      senderInitials: message.sender.name.slice(0, 2).toUpperCase(),
      senderAvatar:
        message.senderId === profile?.id
          ? profile.avatar
          : message.sender.avatar,
      time: new Date(message.createdAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
    }),
  );
  const displayMessages = Array.from(
    new Map(
      [...loadedMessages, ...messages].map((message) => [message.id, message]),
    ).values(),
  );

  useEffect(() => {
    if (!activeId) return;

    let disposed = false;

    async function connect() {
      const token = await getAccessToken();

      if (!token || disposed) return;

      const socket = new WebSocket(`ws://localhost:8080/chats/${activeId}/ws`);

      socketRef.current = socket;

      socket.onopen = () => {
        console.log("Connected");

        socket.send(
          JSON.stringify({
            type: "subscribe",
            chatId: activeId,
            token,
          }),
        );
      };

      socket.onmessage = (event) => handleSocketMessage(event);

      socket.onerror = () => handleSocketError();
    }

    void connect();

    return () => {
      disposed = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [activeId, getAccessToken]);

  function handleSocketMessage(event: MessageEvent) {
    const payload = JSON.parse(event.data) as {
      channel?: string;
      data:
        | Array<{
            id: string;
            senderId: string;
            content: string;
            createdAt: string;
            sender?: { name: string; avatar: string | null };
          }>
        | {
            id: string;
            senderId: string;
            content: string;
            createdAt: string;
            sender?: { name: string; avatar: string | null };
          };
      message?: string;
    };

    if (payload.channel === "history") {
      if (!Array.isArray(payload.data)) return;
      const historyMessages: ChatMessage[] = payload.data.map((message) => ({
        id: message.id,
        text: message.content,
        outgoing: message.senderId === profile?.id,
        senderName: message.sender?.name,
        senderInitials: message.sender?.name.slice(0, 2).toUpperCase(),
        senderAvatar:
          message.senderId === profile?.id
            ? profile.avatar
            : message.sender?.avatar,
        time: new Date(message.createdAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
      }));
      setMessages(historyMessages);
    }

    if (payload.channel === "message" && !Array.isArray(payload.data)) {
      const newMessage: ChatMessage = {
        id: payload.data.id,
        text: payload.data.content,
        outgoing: payload.data.senderId === profile?.id,
        time: new Date(payload.data.createdAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
        senderName: payload.data.sender?.name,
        senderInitials: payload.data.sender?.name?.slice(0, 2).toUpperCase(),
        senderAvatar:
          payload.data.senderId === profile?.id
            ? profile.avatar
            : payload.data.sender?.avatar,
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    }

    if (payload.channel === "error") {
      console.error("WebSocket error:", payload.message);
    }
  }

  function handleSocketError() {
    console.error("Chat connection failed");
  }

  function sendMessage(text: string) {
    async function replyToDM() {
      if (!activeId || !profile || selected?.type !== "DM") return;

      try {
        const admin = new web3.PublicKey(
          "EEjBLRkRAxMUX1dmeNhBkZN7FwbfLuV5xUXmguUUCZ7r",
        );
        const mint = new web3.PublicKey(
          "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        );
        const participantWallet = wallets[0];
        const walletAddress = participantWallet?.address?.trim();
        if (!walletAddress) {
          throw new Error("Connected Solana wallet is not available");
        }

        let participant: web3.PublicKey;
        try {
          participant = new web3.PublicKey(walletAddress);
        } catch {
          throw new Error("Your profile has an invalid Solana wallet address");
        }
        const solanaConnection = new web3.Connection(
          process.env.NEXT_PUBLIC_SOLANA_RPC_URL!,
          "confirmed",
        );

        const orderId = new Uint8Array(32);
        const authorityEpoch = new BN(0);

        const releaseInput = {
          admin,
          participant,
          mint,
          orderId,
          authorityEpoch,
        };

        const anchorWallet = {
          publicKey: participant,
          signTransaction: async <T,>(transaction: T) => transaction,
        } as Wallet;

        const instruction = await releasePayment(anchorWallet, releaseInput);

        const transaction = new web3.Transaction().add(instruction);
        transaction.feePayer = new web3.PublicKey(
          "EEjBLRkRAxMUX1dmeNhBkZN7FwbfLuV5xUXmguUUCZ7r",
        );

        transaction.recentBlockhash = (
          await solanaConnection.getLatestBlockhash("confirmed")
        ).blockhash;
        const unsignedTransaction = transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });

        const { signedTransaction } = await signTransaction({
          transaction: unsignedTransaction,
          wallet: participantWallet,
          chain: "solana:devnet",
        });

        console.log("Release transaction signed:", {
          participant: participant.toBase58(),
          orderId: Array.from(orderId),
          signedTransactionBytes: signedTransaction.length,
          signedTransaction,
        });

        const signedTx = web3.Transaction.from(signedTransaction);

        const participantSignature = signedTx.signatures.find((entry) =>
          entry.publicKey.equals(participant),
        )?.signature;

        if (!participantSignature) {
          throw new Error("Participant signature missing");
        }

        const signatureId =
          Buffer.from(participantSignature).toString("base64");

        const signedTransactionBase64 = Buffer.from(
          signedTx.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
          }),
        ).toString("base64");

        console.log("dsds", {
          signatureId,
          signedTransaction: signedTransactionBase64,
        });

        replyDM.mutate(
          {
            chatId: activeId,
            input: {
              message: text.trim(),
              signedTransaction: signedTransactionBase64,
            },
          },
          {
            onError: (error) => console.error("DM reply failed:", error),
          },
        );
      } catch (error) {
        console.error("Failed to sign release transaction:", error);
      }
    }

    if (selected?.type === "DM") {
      void replyToDM();
      return;
    }

    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      console.error("Chat socket is not connected");
      return;
    }

    socketRef.current.send(JSON.stringify({ content: text }));
  }

  function selectConversation(id: string) {
    setSelectedId(id);
    setShowThread(true);
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
            selectedId={activeId ?? ""}
            onSelect={selectConversation}
          />
        </aside>

        <section
          className={cn(
            "min-h-0 min-w-0 flex-col bg-background md:flex",
            showThread ? "flex" : "hidden md:flex",
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
              {selected?.avatar ? (
                <AvatarImage src={selected.avatar} alt="" />
              ) : null}
              <AvatarFallback className="bg-muted text-foreground">
                {selected?.initials ?? "—"}
              </AvatarFallback>
            </Avatar>
            <h2 className="min-w-0 flex-1 truncate font-medium">
              {selected?.name ?? "Chats"}
            </h2>
            {selected?.type === "GROUP" && (
              <GrpMembersDialog members={dialogMembers}>
                <Button
                  variant="ghost"
                  className="gap-2 text-muted-foreground hover:text-foreground"
                  aria-label={`View ${dialogMembers.length} members`}
                >
                  <UsersIcon aria-hidden="true" />
                  <span>{dialogMembers.length}</span>
                </Button>
              </GrpMembersDialog>
            )}
          </header>

          {isLoading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Loading chats…
            </div>
          ) : isError ? (
            <div className="flex flex-1 items-center justify-center text-sm text-destructive">
              Could not load chats.
            </div>
          ) : selected ? (
            <>
              <div className="min-h-0 flex-1">
                <ChatMessages
                  key={selected.id}
                  messages={displayMessages}
                  name={selected.name}
                  initials={selected.initials}
                />
              </div>
              <ChatComposer
                key={selected.id}
                onSend={(text) => sendMessage(text)}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-sm space-y-2 text-center">
                <p className="font-medium">Your chats will appear here</p>
                <p className="text-sm text-muted-foreground">
                  Start a conversation with a creator to see your messages in
                  this space.
                </p>
              </div>
            </div>
          )}
        </section>
      </Card>
    </main>
  );
}
