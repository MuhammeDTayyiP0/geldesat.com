import { EventEmitter } from "node:events";

export type ChatMessagePayload = {
  id: string;
  sender_id: string;
  content: string;
  /** text | image | offer */
  kind?: string;
  meta?: Record<string, unknown> | null;
  deleted?: boolean;
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
      /** An existing message changed: deleted for everyone, or an offer answered. */
      type: "message_update";
      conversationId: string;
      message: ChatMessagePayload;
    }
  | {
      type: "read";
      conversationId: string;
      reads: { id: string; read_at: string }[];
    }
  | {
      type: "typing";
      conversationId: string;
      userId: string;
    };

export type UserInboxEvent =
  | {
      type: "new_message";
      conversationId: string;
      message: ChatMessagePayload;
    }
  | {
      type: "read_update";
      conversationId?: string;
      reads?: { id: string; read_at: string }[];
    }
  | {
      type: "inbox_ping";
      conversationId?: string;
    }
  | {
      /** A new in-app notification: refresh the bell badge. */
      type: "notification";
    };

// Global event bus surviving HMR in development
const globalRef = globalThis as typeof globalThis & {
  __geldesatChatBus__?: EventEmitter;
  __geldesatPresence__?: { online: Map<string, number>; viewing: Map<string, Map<string, number>> };
};

export const chatBus = (globalRef.__geldesatChatBus__ ??= new EventEmitter());
chatBus.setMaxListeners(1000);

export function broadcastChatMessage(conversationId: string, message: ChatMessagePayload) {
  chatBus.emit(`chat:${conversationId}`, {
    type: "message",
    conversationId,
    message,
  });
}

export function broadcastChatUpdate(conversationId: string, message: ChatMessagePayload) {
  chatBus.emit(`chat:${conversationId}`, { type: "message_update", conversationId, message });
}

export function broadcastChatRead(conversationId: string, reads: { id: string; read_at: string }[]) {
  chatBus.emit(`chat:${conversationId}`, {
    type: "read",
    conversationId,
    reads,
  });
}

export function broadcastTyping(conversationId: string, userId: string) {
  chatBus.emit(`chat:${conversationId}`, { type: "typing", conversationId, userId });
}

export function broadcastUserInbox(userId: string, event: UserInboxEvent) {
  chatBus.emit(`user:${userId}`, event);
}

/*
 * Presence, from open chat streams (one per browser tab). In-process like the
 * bus itself, which matches the single Node process GeldeSat runs as.
 */
const presence = (globalRef.__geldesatPresence__ ??= { online: new Map(), viewing: new Map() });

/** Register an open stream; returns the function that unregisters it. */
export function trackPresence(userId: string, conversationId: string | null): () => void {
  presence.online.set(userId, (presence.online.get(userId) ?? 0) + 1);
  if (conversationId) {
    const threads = presence.viewing.get(userId) ?? new Map<string, number>();
    threads.set(conversationId, (threads.get(conversationId) ?? 0) + 1);
    presence.viewing.set(userId, threads);
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const n = (presence.online.get(userId) ?? 1) - 1;
    if (n > 0) presence.online.set(userId, n);
    else presence.online.delete(userId);
    if (conversationId) {
      const threads = presence.viewing.get(userId);
      const c = (threads?.get(conversationId) ?? 1) - 1;
      if (threads && c > 0) threads.set(conversationId, c);
      else threads?.delete(conversationId);
      if (threads && !threads.size) presence.viewing.delete(userId);
    }
  };
}

export function isOnline(userId: string): boolean {
  return presence.online.has(userId);
}

/** True while the user has this chat open in some tab (so a notification would be noise). */
export function isViewingConversation(userId: string, conversationId: string): boolean {
  return Boolean(presence.viewing.get(userId)?.has(conversationId));
}
