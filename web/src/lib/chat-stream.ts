/**
 * One shared `/api/chat/stream` EventSource per browser tab.
 *
 * The header (unread badges), the inbox and an open thread all listen to the
 * same connection. While a thread is open the stream URL carries its
 * `conversationId`, so the server also forwards that thread's message and read
 * events; the user's own inbox events are always included.
 */
export type ChatStreamEvent = { type: string; [key: string]: unknown };
type Listener = (event: ChatStreamEvent) => void;

const listeners = new Set<Listener>();
const openThreads: string[] = [];
let source: EventSource | null = null;
let sourceUrl = "";
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function wantedUrl(): string {
  if (!listeners.size) return "";
  const thread = openThreads.at(-1);
  return thread ? `/api/chat/stream?conversationId=${encodeURIComponent(thread)}` : "/api/chat/stream";
}

function sync(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  const url = wantedUrl();
  if (source && sourceUrl === url) return;
  source?.close();
  source = null;
  sourceUrl = url;
  if (!url || typeof EventSource === "undefined") return;

  const es = new EventSource(url);
  source = es;
  es.onmessage = (message) => {
    let event: ChatStreamEvent;
    try {
      event = JSON.parse(message.data) as ChatStreamEvent;
    } catch {
      return; // keepalive comment or malformed payload
    }
    for (const listener of [...listeners]) listener(event);
  };
  es.onerror = () => {
    // The browser retries transient drops itself; only a closed stream needs us.
    if (source !== es || es.readyState !== EventSource.CLOSED) return;
    source = null;
    sourceUrl = "";
    retryTimer = setTimeout(sync, 5000);
  };
}

/** Listen to the shared stream; pass `conversationId` while a thread is open. Returns the unsubscribe. */
export function subscribeChatStream(listener: Listener, conversationId?: string): () => void {
  listeners.add(listener);
  if (conversationId) openThreads.push(conversationId);
  sync();
  return () => {
    listeners.delete(listener);
    if (conversationId) {
      const index = openThreads.lastIndexOf(conversationId);
      if (index >= 0) openThreads.splice(index, 1);
    }
    sync();
  };
}
