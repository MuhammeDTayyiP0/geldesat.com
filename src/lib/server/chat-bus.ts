import { EventEmitter } from "node:events";

export type ChatMessagePayload = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

export type ChatEvent =
  | {
      type: "message";
      conversationId: string;
      message: ChatMessagePayload;
    }
  | {
      type: "read";
      conversationId: string;
      reads: { id: string; read_at: string }[];
    };

// Global event bus surviving HMR in development
const globalRef = globalThis as typeof globalThis & {
  __geldesatChatBus__?: EventEmitter;
};

export const chatBus = (globalRef.__geldesatChatBus__ ??= new EventEmitter());
chatBus.setMaxListeners(500);

export function broadcastChatMessage(conversationId: string, message: ChatMessagePayload) {
  chatBus.emit(`chat:${conversationId}`, {
    type: "message",
    conversationId,
    message,
  });
}

export function broadcastChatRead(conversationId: string, reads: { id: string; read_at: string }[]) {
  chatBus.emit(`chat:${conversationId}`, {
    type: "read",
    conversationId,
    reads,
  });
}
