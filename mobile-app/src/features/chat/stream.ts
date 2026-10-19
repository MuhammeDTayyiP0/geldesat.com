import { AppState, type AppStateStatus } from 'react-native';
import { API_BASE_URL } from '@/lib/config';
import { getToken } from '@/auth/session';

/**
 * One shared /api/chat/stream connection (server-sent events) for the app,
 * like web/src/lib/chat-stream.ts. React Native has no EventSource, so this
 * reads the stream through XMLHttpRequest progress events. The tab badges, the
 * inbox and an open thread share it; while a thread is open the URL carries its
 * conversationId so its message/read/typing events arrive too. The connection
 * closes in the background and reopens when the app returns.
 */
export type ChatStreamEvent = { type: string; conversationId?: string; [key: string]: unknown };
type Listener = (event: ChatStreamEvent) => void;

const listeners = new Set<Listener>();
const openThreads: string[] = [];
let xhr: XMLHttpRequest | null = null;
let currentUrl = '';
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 2000;
let appState: AppStateStatus = (AppState.currentState as AppStateStatus | null) ?? 'active';
const reconnectListeners = new Set<() => void>();

AppState.addEventListener('change', (next) => {
  const wasActive = appState === 'active';
  appState = next;
  if (next === 'active' && !wasActive) {
    retryDelay = 2000;
    sync(true);
    // Events may have been missed while away: let screens refetch.
    for (const fn of reconnectListeners) fn();
  } else if (next !== 'active') {
    close();
  }
});

function wantedUrl(): string {
  if (!listeners.size || !getToken() || appState !== 'active') return '';
  const thread = openThreads[openThreads.length - 1];
  return thread ? `/api/chat/stream?conversationId=${encodeURIComponent(thread)}` : '/api/chat/stream';
}

function close() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  const old = xhr;
  xhr = null;
  currentUrl = '';
  old?.abort();
}

function dispatch(block: string) {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!data) return;
  let event: ChatStreamEvent;
  try {
    event = JSON.parse(data) as ChatStreamEvent;
  } catch {
    return;
  }
  for (const listener of [...listeners]) listener(event);
}

function scheduleRetry() {
  if (retryTimer || !wantedUrl()) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    sync(true);
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 30_000);
}

function sync(force = false) {
  const url = wantedUrl();
  if (!force && xhr && currentUrl === url) return;
  close();
  if (!url) return;
  const token = getToken();
  const request = new XMLHttpRequest();
  xhr = request;
  currentUrl = url;
  let seen = 0;
  let buffer = '';
  request.open('GET', `${API_BASE_URL}${url}`);
  request.setRequestHeader('Accept', 'text/event-stream');
  request.setRequestHeader('Cache-Control', 'no-cache');
  if (token) request.setRequestHeader('Authorization', `Bearer ${token}`);
  request.onprogress = () => {
    if (xhr !== request) return;
    retryDelay = 2000;
    const text = request.responseText;
    buffer += text.slice(seen);
    seen = text.length;
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) dispatch(block);
  };
  request.onreadystatechange = () => {
    if (xhr !== request || request.readyState !== XMLHttpRequest.DONE) return;
    xhr = null;
    currentUrl = '';
    // 401/403: the session or thread is gone; do not hammer the server.
    if (request.status === 401 || request.status === 403) return;
    scheduleRetry();
  };
  request.onerror = () => {
    if (xhr !== request) return;
    xhr = null;
    currentUrl = '';
    scheduleRetry();
  };
  request.send();
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

/** Called when the app comes back to the foreground (missed events may need a refetch). */
export function onStreamResume(fn: () => void): () => void {
  reconnectListeners.add(fn);
  return () => {
    reconnectListeners.delete(fn);
  };
}

/** Reconnect with the current token (after sign-in) or drop the stream (after sign-out). */
export function resetChatStream() {
  sync(true);
}
