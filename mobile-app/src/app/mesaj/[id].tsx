import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  Ban,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  Copy,
  ExternalLink,
  Flag,
  HandCoins,
  ImageIcon,
  ImagePlus,
  MailOpen,
  MapPin,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Reply,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  X,
  Zap,
} from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account, chat, uploads } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { ChatMessage } from '@/api/types';
import { useSession } from '@/auth/session';
import { Bubble } from '@/features/chat/Bubble';
import { SwipeToReply } from '@/features/chat/SwipeToReply';
import { LocationPicker } from '@/features/chat/LocationPicker';
import { BUYER_QUICK_REPLIES, CHAT_REPORT_REASONS, DELETE_WINDOW_MS, EDIT_WINDOW_MS, LISTING_PHOTO_MSG, SELLER_QUICK_REPLIES, previewText } from '@/features/chat/shared';
import { onStreamResume, subscribeChatStream } from '@/features/chat/stream';
import { PhotoViewer } from '@/features/listing/Gallery';
import { PhotoReview } from '@/features/photos/PhotoReview';
import { mediaUrl } from '@/lib/config';
import { dayLabel, formatPrice, formatTime, lastSeenLabel, maskThousands, parseMasked } from '@/lib/format';
import { pickPhotos, preparePhoto, type PickedPhoto } from '@/lib/photos';
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  ListRow,
  Loading,
  RowGroup,
  Sheet,
  Text,
  confirm,
  font,
  hairline,
  radius,
  space,
  toast,
  useTheme,
  type TextInputRef,
} from '@/ui';

type Row = { type: 'message'; message: ChatMessage; grouped: boolean } | { type: 'day'; key: string; label: string };
type SheetName = 'attach' | 'offer' | 'location' | 'menu' | 'report' | 'search' | 'actions' | 'info' | null;

/** Photos per send; the server allows 20 chat photos per 10 minutes. */
const MAX_CHAT_PHOTOS = 5;
const SAFETY_KEY = 'geldesat.chatSafetyDismissed.v1';

function sortMessages(list: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of list) byId.set(m.id, m);
  // A confirmed message replaces its "sending…" bubble (same client id).
  const confirmed = new Set([...byId.values()].filter((m) => !m.pending && m.client_id).map((m) => m.client_id));
  return [...byId.values()].filter((m) => !(m.pending && m.client_id && confirmed.has(m.client_id))).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Merge new and changed messages. A changed message older than everything loaded
 * (an old offer answered) is left out: added at the top it would move the
 * "load older" cursor past the messages in between.
 */
function mergeMessages(list: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const oldest = list.find((m) => !m.pending)?.created_at;
  const known = new Set(list.map((m) => m.id));
  return sortMessages([...list, ...incoming.filter((m) => known.has(m.id) || !oldest || m.created_at >= oldest)]);
}

/** Calendar day in the phone's time zone (created_at is UTC). */
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const newClientId = () => Crypto.randomUUID();

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  // The keyboard covers the home indicator, so the composer drops that inset while it is up.
  const keyboardUp = useKeyboardState((k) => k.isVisible);
  const router = useRouter();
  const goBackOrInbox = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/mesajlar');
  }, [router]);
  const session = useSession();
  const me = session.status === 'signedIn' ? session.user.id : '';
  const token = session.status === 'signedIn' ? session.token : '';
  // Follows the session: a token from before a new sign-in would get 401 for photos.
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  // Only the chat on screen counts as read and as "being viewed" (which also silences its push).
  const focused = useIsFocused();
  const focusedRef = useRef(focused);
  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);

  const thread = useQuery({ queryKey: keys.thread(id), queryFn: () => chat.thread(id), staleTime: 0, enabled: !!me, refetchOnReconnect: false });
  const templates = useQuery({ queryKey: keys.templates, queryFn: chat.templates, enabled: !!me, staleTime: 5 * 60_000 });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [jumped, setJumped] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  /** Shown above the box while photos upload ("Fotoğraflar gönderiliyor (2/3)…"). */
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  /** Photos picked for sending, shown full screen first (caption, turn, remove). */
  const [review, setReview] = useState<PickedPhoto[] | null>(null);
  const [quick, setQuick] = useState(false);
  const [typing, setTyping] = useState(false);
  const [safetyHidden, setSafetyHidden] = useState(true);
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(SAFETY_KEY)
      .then((val) => {
        if (alive) setSafetyHidden(val === '1');
      })
      .catch(() => {
        if (alive) setSafetyHidden(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  const dismissSafety = () => {
    setSafetyHidden(true);
    void AsyncStorage.setItem(SAFETY_KEY, '1').catch(() => undefined);
  };
  const [presence, setPresence] = useState<{ online: boolean; lastSeen: string | null }>({ online: false, lastSeen: null });
  const [sheet, setSheet] = useState<SheetName>(null);
  // Next step chosen in a sheet (photo picker, another sheet, a confirm), run
  // once that sheet's modal is gone: opening it earlier freezes the app.
  const afterClose = useRef<(() => void) | null>(null);
  const thenClose = (next: () => void) => {
    afterClose.current = next;
    setSheet(null);
  };
  const runAfterClose = () => {
    const next = afterClose.current;
    afterClose.current = null;
    next?.();
  };
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [selectedDeletable, setSelectedDeletable] = useState(false);
  const [selectedEditable, setSelectedEditable] = useState(false);
  const [away, setAway] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const awayRef = useRef(false);
  const inputRef = useRef<TextInputRef>(null);
  const [counterTo, setCounterTo] = useState<ChatMessage | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const clearJumpTimers = useCallback(() => {
    if (highlightTimer.current) {
      clearTimeout(highlightTimer.current);
      highlightTimer.current = null;
    }
    if (scrollRetryTimer.current) {
      clearTimeout(scrollRetryTimer.current);
      scrollRetryTimer.current = null;
    }
  }, []);
  const listRef = useRef<FlatList<Row>>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const data = thread.data;
  const conv = data?.conversation;
  const currency = conv?.listing_currency ?? conv?.currency ?? 'TRY';
  // sohbet_v2: the first unread message from when the chat opened gets a divider, and the list starts there.
  const firstUnreadId = data?.firstUnreadId ?? null;

  // Take the server's page on first load; subsequent background refetches merge
  // so failed optimistic messages and already-loaded older pages are never wiped.
  const [syncedAt, setSyncedAt] = useState(0);
  const [syncedId, setSyncedId] = useState(id);
  const [resetOnSync, setResetOnSync] = useState(false);
  const jumpedRef = useRef(jumped);
  useEffect(() => {
    jumpedRef.current = jumped;
  }, [jumped]);
  // Where the last catch-up started (phone clock, with a margin for clock drift).
  const syncedFrom = useRef<string | null>(null);
  // Open at the first unread message, once per load.
  const scrolledToUnread = useRef<number | null>(null);
  useEffect(() => {
    awayRef.current = false;
    jumpedRef.current = false;
    syncedFrom.current = null;
    scrolledToUnread.current = null;
    clearJumpTimers();
    return clearJumpTimers;
  }, [id, clearJumpTimers]);
  if (id !== syncedId) {
    setSyncedId(id);
    setSyncedAt(0);
    setMessages([]);
    setHasMore(false);
    setJumped(false);
    setHighlight(null);
    setResetOnSync(false);
    setText('');
    setReplyTo(null);
    setCounterTo(null);
    setSheet(null);
    setSelected(null);
    setAway(false);
    setUnseen(0);
    setTyping(false);
  } else if (data && thread.dataUpdatedAt !== syncedAt) {
    const firstSync = syncedAt === 0;
    setSyncedAt(thread.dataUpdatedAt);
    if (firstSync || resetOnSync) {
      setMessages(data.messages);
      setHasMore(data.hasMore);
      setJumped(false);
      setResetOnSync(false);
    } else if (!jumped) {
      setMessages((prev) => mergeMessages(prev, data.messages));
    }
    setPresence({ online: data.conversation.other_online, lastSeen: data.conversation.other_last_seen });
  }

  const backToLatest = useCallback(async () => {
    setResetOnSync(true);
    try {
      const res = await thread.refetch();
      if (res.data) {
        const pending = messagesRef.current.filter((m) => m.pending);
        setMessages(pending.length ? mergeMessages(pending, res.data.messages) : res.data.messages);
        setHasMore(res.data.hasMore);
        setJumped(false);
        jumpedRef.current = false;
        setSyncedAt(res.dataUpdatedAt);
        setPresence({ online: res.data.conversation.other_online, lastSeen: res.data.conversation.other_last_seen });
        setUnseen(0);
      } else if (res.error) {
        toast.error(errorMessage(res.error));
      }
    } finally {
      setResetOnSync(false);
    }
  }, [thread]);

  const markRead = useCallback(() => {
    void chat
      .markRead(id)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: keys.counts });
        void queryClient.invalidateQueries({ queryKey: keys.inbox });
      })
      .catch(() => undefined);
  }, [id]);

  useEffect(() => {
    if (data && focused) markRead();
  }, [data, focused, markRead]);

  useEffect(() => {
    // A fresh page from the server: changes after it (an offer answered, a message deleted) come with the next catch-up.
    if (syncedAt) syncedFrom.current = new Date(syncedAt - 2 * 60_000).toISOString();
  }, [syncedAt]);
  const catchUp = useCallback(() => {
    if (jumpedRef.current) return;
    const newest = [...messagesRef.current].reverse().find((m) => !m.pending);
    const after = syncedFrom.current ?? newest?.created_at;
    if (!after) return;
    const startedAt = new Date(Date.now() - 2 * 60_000).toISOString();
    void chat
      .poll(id, after)
      .then((r) => {
        if (jumpedRef.current) return;
        syncedFrom.current = startedAt;
        const reads = new Map(r.reads.map((x) => [x.id, x.read_at]));
        setMessages((cur) => mergeMessages(cur, r.messages).map((m) => (reads.has(m.id) ? { ...m, read_at: reads.get(m.id) ?? m.read_at } : m)));
        setPresence({ online: r.other_online, lastSeen: r.other_last_seen });
        if (r.messages.some((m) => m.sender_id !== me) && focusedRef.current) markRead();
      })
      .catch(() => undefined);
  }, [id, me, markRead]);

  // Live events for this chat, only while it is on screen; coming back catches up.
  useEffect(() => {
    if (!me || !focused) return;
    if (messagesRef.current.length) catchUp();
    const off = subscribeChatStream((event) => {
      if (event.conversationId !== id) return;
      if (event.type === 'message' || event.type === 'message_update') {
        const msg = event.message as ChatMessage;
        const normalized: ChatMessage = { ...msg, kind: msg.kind ?? 'text', meta: msg.meta ?? null, deleted: !!msg.deleted, reply: msg.reply ?? null };
        if (jumpedRef.current) {
          if (event.type === 'message_update') {
            setMessages((list) => list.map((m) => (m.id === normalized.id ? normalized : m)));
          } else if (msg.sender_id !== me) {
            setUnseen((n) => n + 1);
            setTyping(false);
          }
          return;
        }
        setMessages((list) => mergeMessages(list, [normalized]));
        if (event.type === 'message' && msg.sender_id !== me && awayRef.current) setUnseen((n) => n + 1);
        if (event.type === 'message' && msg.sender_id !== me) {
          setTyping(false);
          markRead();
        }
      } else if (event.type === 'read') {
        const reads = new Map((event.reads as { id: string; read_at: string }[]).map((r) => [r.id, r.read_at]));
        setMessages((list) => list.map((m) => (reads.has(m.id) ? { ...m, read_at: reads.get(m.id) ?? m.read_at } : m)));
      } else if (event.type === 'typing' && event.userId !== me) {
        setTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 4000);
      }
    }, id);
    // Back from the background, or the connection came back: fetch what was missed.
    const offResume = onStreamResume(catchUp);
    // A safety net for a connection that looks open but delivers nothing.
    const poll = setInterval(() => {
      if (AppState.currentState === 'active') catchUp();
    }, 30_000);
    return () => {
      off();
      offResume();
      clearInterval(poll);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [id, me, focused, markRead, catchUp]);

  // Inverted list: newest first, with day separators.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const prev = messages[i - 1];
      const sameDay = prev && localDay(prev.created_at) === localDay(m.created_at);
      const grouped = !!prev && sameDay && prev.sender_id === m.sender_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
      out.push({ type: 'message', message: m, grouped });
      if (m.id === firstUnreadId) out.push({ type: 'day', key: 'unread', label: 'Okunmamış mesajlar' });
      if (!sameDay) out.push({ type: 'day', key: `day-${localDay(m.created_at)}`, label: dayLabel(m.created_at) });
    }
    return out;
  }, [messages, firstUnreadId]);

  const loadOlder = async () => {
    const oldest = messages.find((m) => !m.pending);
    if (!hasMore || loadingOlder || !oldest) return;
    setLoadingOlder(true);
    try {
      const r = await chat.older(id, oldest.created_at);
      setMessages((list) => sortMessages([...r.messages, ...list]));
      setHasMore(r.hasMore);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoadingOlder(false);
    }
  };

  const appendOwn = (msg: ChatMessage) => {
    setMessages((list) => sortMessages([...list, msg]));
    if (jumpedRef.current) void backToLatest();
  };

  /**
   * Send a message. `fromInput`: the text came from the box; a quick reply leaves
   * the box alone. The message shows at once as "sending…" and a failed one can
   * be tapped to retry; the same client id makes a retry safe on the server.
   */
  const send = async (content: string, { fromInput = true, retry }: { fromInput?: boolean; retry?: ChatMessage } = {}) => {
    const value = content.trim();
    if (!value) return;
    if (fromInput && !retry && editingMsg) {
      const target = editingMsg;
      setEditingMsg(null);
      setText('');
      try {
        const res = await chat.editMessage(target.id, value);
        setMessages((list) => mergeMessages(list, [res.message]));
        toast.success('Mesaj düzenlendi');
      } catch (e) {
        toast.error(errorMessage(e));
      }
      return;
    }
    const reply = retry ? (retry.reply ? messagesRef.current.find((m) => m.id === retry.reply?.id) ?? null : null) : replyTo;
    const clientId = retry?.client_id ?? newClientId();
    if (!retry) {
      if (fromInput) setText('');
      setReplyTo(null);
      setQuick(false);
    }
    const local: ChatMessage = {
      id: `local-${clientId}`,
      client_id: clientId,
      sender_id: me,
      content: value,
      kind: 'text',
      meta: null,
      deleted: false,
      reply: reply ? { id: reply.id, sender_id: reply.sender_id, content: reply.content, kind: reply.kind } : null,
      created_at: retry?.created_at ?? new Date().toISOString(),
      read_at: null,
      pending: 'sending',
    };
    setMessages((list) => sortMessages([...list.filter((m) => m.id !== local.id), local]));
    try {
      appendOwn(await chat.send(id, value, reply?.id, clientId));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void queryClient.invalidateQueries({ queryKey: keys.inbox });
    } catch (e) {
      setMessages((list) => list.map((m) => (m.id === local.id ? { ...m, pending: 'failed' } : m)));
      toast.error(errorMessage(e));
    }
  };

  const onChangeText = (value: string) => {
    setText(value);
    const now = Date.now();
    if (value && now - lastTypingSent.current > 3000) {
      lastTypingSent.current = now;
      void chat.typing(id).catch(() => undefined);
    }
  };

  const sendPhoto = async (source: 'camera' | 'library') => {
    setSheet(null);
    try {
      const picked = await pickPhotos(source, MAX_CHAT_PHOTOS);
      if (picked.length) setReview(picked);
    } catch (e) {
      toast.error(errorMessage(e, 'Fotoğraf seçilemedi.'));
    }
  };

  /** Sent only after the review screen: the photos in order, then the caption as a message. */
  const sendReviewed = async (photos: PickedPhoto[], caption: string) => {
    setReview(null);
    setSending(true);
    // Photos cannot quote a message; a reply goes with the caption.
    const reply = caption ? replyTo : null;
    if (caption) setReplyTo(null);
    let sent = 0;
    setUploadNote(photos.length > 1 ? `Fotoğraflar gönderiliyor (1/${photos.length})…` : 'Fotoğraf gönderiliyor…');
    try {
      for (const photo of photos) {
        if (photos.length > 1) setUploadNote(`Fotoğraflar gönderiliyor (${sent + 1}/${photos.length})…`);
        const prepared = await preparePhoto(photo);
        appendOwn(await uploads.chatPhoto(id, prepared));
        sent += 1;
      }
      if (caption) appendOwn(await chat.send(id, caption, reply?.id));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      const rest = photos.length - sent;
      toast.error(rest > 0 && sent > 0 ? `${sent} fotoğraf gönderildi, ${rest} tanesi gönderilemedi. ${errorMessage(e)}` : errorMessage(e));
      // Nothing is lost: the caption goes back into the box and unsent photos back into review.
      if (caption) {
        setText((current) => (current.trim() ? current : caption));
        setReplyTo((current) => current ?? reply);
      }
      if (sent < photos.length) setReview(photos.slice(sent));
    } finally {
      setSending(false);
      setUploadNote(null);
      void queryClient.invalidateQueries({ queryKey: keys.inbox });
    }
  };

  const respondOffer = async (m: ChatMessage, action: 'accept' | 'reject' | 'counter') => {
    if (action === 'counter') {
      setCounterTo(m);
      setSheet('offer');
      return;
    }
    const ok = await confirm({
      title: action === 'accept' ? 'Teklif kabul edilsin mi?' : 'Teklif reddedilsin mi?',
      message: `${formatPrice(m.meta?.amount ?? 0, currency)} teklif`,
      confirmText: action === 'accept' ? 'Kabul et' : 'Reddet',
      destructive: action === 'reject',
    });
    if (!ok) return;
    try {
      const updated = await chat.respondOffer(m.id, action === 'accept');
      setMessages((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      toast.success(action === 'accept' ? 'Teklif kabul edildi. Buluşmayı mesajlaşarak ayarlayabilirsiniz.' : 'Teklif reddedildi');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const pendingJumpId = useRef<string | null>(null);
  const jumpTo = async (messageId: string) => {
    clearJumpTimers();
    if (messages.some((m) => m.id === messageId)) {
      const index = rows.findIndex((r) => r.type === 'message' && r.message.id === messageId);
      if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    } else {
      try {
        const r = await chat.around(id, messageId);
        pendingJumpId.current = messageId;
        setMessages(r.messages);
        setHasMore(r.hasMoreBefore);
        setJumped(r.hasMoreAfter);
        jumpedRef.current = r.hasMoreAfter;
      } catch (e) {
        toast.error(errorMessage(e));
        return;
      }
    }
    setHighlight(messageId);
    highlightTimer.current = setTimeout(() => {
      highlightTimer.current = null;
      setHighlight(null);
    }, 2200);
  };

  useEffect(() => {
    const target = pendingJumpId.current;
    if (!target) return;
    const index = rows.findIndex((r) => r.type === 'message' && r.message.id === target);
    if (index < 0) return;
    pendingJumpId.current = null;
    const t = setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true }), 120);
    return () => clearTimeout(t);
  }, [rows]);

  // Stable callbacks for the memoized bubbles: typing in the box must not re-render every message.
  const latest = useRef({ jumpTo, respondOffer, send });
  useEffect(() => {
    latest.current = { jumpTo, respondOffer, send };
  });
  const openActions = useCallback(
    (m: ChatMessage) => {
      if (m.pending) return;
      void Haptics.selectionAsync();
      setSelected(m);
      setSelectedDeletable(m.sender_id === me && Date.now() - new Date(m.created_at).getTime() < DELETE_WINDOW_MS);
      setSelectedEditable(
        m.sender_id === me &&
          !m.deleted &&
          m.kind === 'text' &&
          m.content !== LISTING_PHOTO_MSG &&
          Date.now() - new Date(m.created_at).getTime() <= EDIT_WINDOW_MS,
      );
      setSheet('actions');
    },
    [me],
  );
  const openInfo = useCallback((m: ChatMessage) => {
    setSelected(m);
    setSheet('info');
  }, []);
  const retrySend = useCallback((m: ChatMessage) => void latest.current.send(m.content, { retry: m }), []);
  const quotePress = useCallback((mid: string) => void latest.current.jumpTo(mid), []);
  const offerAction = useCallback((m: ChatMessage, a: 'accept' | 'reject' | 'counter') => void latest.current.respondOffer(m, a), []);

  const handleSwipeReply = useCallback((m: ChatMessage) => {
    setReplyTo(m);
    inputRef.current?.focus();
  }, []);
  const blockedNow = Boolean(data?.blockedByMe || data?.blockedByOther || conv?.other_closed);
  const renderRow = useCallback(
    ({ item }: { item: Row }) =>
      item.type === 'day' ? (
        <View style={styles.day}>
          <View style={[styles.dayPill, { backgroundColor: c.elevated }]}>
            <Text variant="small" tone="muted">
              {item.label}
            </Text>
          </View>
        </View>
      ) : (
        <MessageRow
          message={item.message}
          grouped={item.grouped}
          mine={item.message.sender_id === me}
          blocked={blockedNow}
          showReads={Boolean(data?.showReads)}
          authHeaders={authHeaders}
          highlighted={highlight === item.message.id}
          otherName={conv?.other_name ?? ''}
          listingImage={conv?.listing_image ?? null}
          listingCurrency={currency}
          onSwipeReply={handleSwipeReply}
          onSwipeInfo={openInfo}
          onLongPress={openActions}
          onInfo={openInfo}
          onRetry={retrySend}
          onOpenImage={setViewer}
          onQuotePress={quotePress}
          onOffer={offerAction}
        />
      ),
    [
      authHeaders,
      blockedNow,
      c.elevated,
      conv?.listing_image,
      conv?.other_name,
      currency,
      data?.showReads,
      handleSwipeReply,
      highlight,
      me,
      offerAction,
      openActions,
      openInfo,
      quotePress,
      retrySend,
    ],
  );

  useEffect(() => {
    if (!firstUnreadId || scrolledToUnread.current === syncedAt) return;
    const index = rows.findIndex((row) => row.type === 'day' && row.key === 'unread');
    if (index < 3) return;
    scrolledToUnread.current = syncedAt;
    const t = setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.9, animated: false }), 250);
    return () => clearTimeout(t);
  }, [firstUnreadId, rows, syncedAt]);

  if (!me) {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <EmptyState icon={Ban} title="Giriş yapın" action={<Button title="Giriş yap" onPress={() => router.push('/giris')} />} />
      </View>
    );
  }

  if (thread.isError && !thread.data) {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <IconButton icon={ChevronLeft} label="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace('/mesajlar'))} />
        <ErrorState error={thread.error} onRetry={() => thread.refetch()} />
      </View>
    );
  }
  if (!data || !conv) {
    return (
      <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <IconButton icon={ChevronLeft} label="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace('/mesajlar'))} />
        <Loading />
      </View>
    );
  }

  const blocked = data.blockedByMe || data.blockedByOther || conv.other_closed;
  const buying = conv.role === 'buying';
  const quickReplies = [...(templates.data ?? []), ...(buying ? BUYER_QUICK_REPLIES : SELLER_QUICK_REPLIES)];
  const status = typing ? 'yazıyor…' : lastSeenLabel(presence.online, presence.lastSeen);
  const pendingOfferFromOther = [...messages].reverse().find((m) => m.kind === 'offer' && m.meta?.status === 'pending' && m.sender_id !== me);
  const listingThumb = mediaUrl(conv.listing_image, 240);

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + space.xs, backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <View style={styles.headRow}>
          <IconButton icon={ChevronLeft} label="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace('/mesajlar'))} />
          <Pressable
            style={styles.person}
            onPress={() => !conv.other_closed && router.push({ pathname: '/satici/[id]', params: { id: conv.other_id } })}
          >
            <Avatar name={conv.other_name} uri={conv.other_avatar} size={38} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {conv.other_name}
              </Text>
              {status ? (
                <Text variant="small" tone={typing || presence.online ? 'ok' : 'subtle'} numberOfLines={1}>
                  {status}
                </Text>
              ) : null}
            </View>
          </Pressable>
          <IconButton icon={Search} label="Sohbette ara" onPress={() => setSheet('search')} />
          <IconButton icon={MoreVertical} label="Seçenekler" onPress={() => setSheet('menu')} />
        </View>
        <Pressable
          onPress={() => conv.listing_id && router.push({ pathname: '/ilan/[id]', params: { id: conv.listing_id } })}
          style={[styles.listing, { backgroundColor: c.elevated }]}
        >
          <View style={[styles.listingThumb, { backgroundColor: c.border }]}>
            {listingThumb ? <Image source={listingThumb} style={StyleSheet.absoluteFill} contentFit="cover" /> : <ImageIcon size={18} color={c.subtle} />}
          </View>
          <View style={styles.flex}>
            <Text variant="caption" numberOfLines={1}>
              {conv.listing_title}
            </Text>
            <Text variant="label" tone="primary">
              {conv.listing_price ? formatPrice(conv.listing_price, currency) : ''}
              {conv.listing_status !== 'ACTIVE' ? (
                <Text variant="small" tone="warn">
                  {'  '}
                  {conv.listing_status === 'SOLD' ? 'Satıldı' : 'Yayında değil'}
                </Text>
              ) : null}
            </Text>
          </View>
          {buying && conv.listing_status === 'ACTIVE' && !blocked ? (
            <Button
              title="Teklif"
              icon={HandCoins}
              size="sm"
              variant="soft"
              onPress={() => {
                setCounterTo(null);
                setSheet('offer');
              }}
            />
          ) : null}
        </Pressable>
      </View>

      {!safetyHidden ? (
        <View style={[styles.safetyBanner, { backgroundColor: c.warnSoft, borderBottomColor: c.border }]}>
          <ShieldAlert size={16} color={c.warn} />
          <Text variant="small" tone="warn" style={styles.flex}>
            Ürünü görmeden kapora göndermeyin, ödemeyi ve yazışmayı GeldeSat dışına taşımayın.
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Uyarıyı kapat" hitSlop={8} onPress={dismissSafety}>
            <X size={15} color={c.warn} />
          </Pressable>
        </View>
      ) : null}

      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        {/* The floating buttons are placed in here, so they stay above the composer as it grows. */}
        <View style={styles.flex}>
          <FlatList
            ref={listRef}
            data={rows}
            inverted
            keyExtractor={(r) => (r.type === 'day' ? r.key : r.message.id)}
            contentContainerStyle={styles.list}
            onEndReached={() => void loadOlder()}
            onEndReachedThreshold={0.3}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            // The target is not measured yet: scroll near it, then try again.
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
              if (scrollRetryTimer.current) clearTimeout(scrollRetryTimer.current);
              scrollRetryTimer.current = setTimeout(() => {
                scrollRetryTimer.current = null;
                listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true });
              }, 120);
            }}
            // Reading older messages: a new one arriving does not push the screen away.
            maintainVisibleContentPosition={away ? { minIndexForVisible: 1 } : undefined}
            scrollEventThrottle={64}
            onScroll={(e) => {
              // Inverted list: offset 0 is the newest message.
              const isAway = e.nativeEvent.contentOffset.y > 320;
              if (isAway !== awayRef.current) {
                awayRef.current = isAway;
                setAway(isAway);
                if (!isAway) setUnseen(0);
              }
            }}
            ListHeaderComponent={
              typing ? (
                <View style={styles.typingWrap}>
                  <View style={[styles.typingPill, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <Text variant="caption" tone="muted">
                      yazıyor…
                    </Text>
                  </View>
                </View>
              ) : undefined
            }
            ListFooterComponent={loadingOlder ? <ActivityIndicator color={c.primary} style={styles.older} /> : undefined}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text tone="muted" center>
                  Sohbete bir mesajla başlayın.
                </Text>
              </View>
            }
            renderItem={renderRow}
          />

          {away && !jumped ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={unseen ? `En alta git, ${unseen} yeni mesaj` : 'En alta git'}
              onPress={() => {
                listRef.current?.scrollToOffset({ offset: 0, animated: true });
                setUnseen(0);
              }}
              style={[styles.toBottom, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <ChevronDown size={22} color={c.fg} />
              {unseen ? (
                <View style={[styles.toBottomBadge, { backgroundColor: c.primarySolid }]}>
                  <Text variant="small" style={[styles.toBottomText, { color: c.onPrimary }]}>
                    {unseen > 99 ? '99+' : unseen}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}

          {jumped ? (
            <Pressable onPress={() => void backToLatest()} style={[styles.latest, { backgroundColor: c.ink }]}>
              <Text variant="label" tone="inverse">
                En yeni mesajlara dön
              </Text>
            </Pressable>
          ) : null}
        </View>

        {blocked ? (
          <View style={[styles.blocked, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: insets.bottom + space.md }]}>
            <Text tone="muted" center>
              {conv.other_closed
                ? 'Bu kullanıcı hesabını kapattı. Mesaj gönderilemez.'
                : data.blockedByMe
                  ? 'Bu kullanıcıyı engellediniz.'
                  : 'Bu kullanıcıyla mesajlaşamazsınız.'}
            </Text>
            {data.blockedByMe ? (
              <Button
                title="Engeli kaldır"
                variant="outline"
                size="sm"
                onPress={async () => {
                  try {
                    await account.unblock(conv.other_id);
                    void thread.refetch();
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              />
            ) : null}
          </View>
        ) : (
          <View style={[styles.composer, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: (keyboardUp ? 0 : insets.bottom) + space.sm }]}>
            {uploadNote ? (
              <View style={styles.uploadNote} accessibilityLiveRegion="polite">
                <ActivityIndicator color={c.primary} size="small" />
                <Text variant="small" tone="muted">
                  {uploadNote}
                </Text>
              </View>
            ) : null}
            {pendingOfferFromOther && !quick && !replyTo ? (
              <Text variant="small" tone="primary" style={styles.offerHint}>
                {conv.other_name} {formatPrice(pendingOfferFromOther.meta?.amount ?? 0, currency)} teklif verdi. Yukarıdan yanıtlayabilirsiniz.
              </Text>
            ) : null}
            {quick ? (
              <FlatList
                horizontal
                data={quickReplies}
                keyExtractor={(q, i) => `${i}-${q}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quick}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => <Chip label={item} onPress={() => void send(item, { fromInput: false })} />}
              />
            ) : null}
            {editingMsg ? (
              <View style={[styles.replyBar, { backgroundColor: c.elevated, borderLeftColor: c.primary }]}>
                <Pencil size={14} color={c.primary} />
                <View style={styles.flex}>
                  <Text variant="small" tone="primary">
                    Mesaj düzenleniyor
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {editingMsg.content}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Düzenlemeyi iptal et"
                  hitSlop={8}
                  onPress={() => {
                    setEditingMsg(null);
                    setText('');
                  }}
                >
                  <X size={16} color={c.subtle} />
                </Pressable>
              </View>
            ) : null}
            {replyTo ? (
              <View style={[styles.replyBar, { backgroundColor: c.elevated, borderLeftColor: c.primary }]}>
                <View style={styles.flex}>
                  <Text variant="small" tone="primary">
                    {replyTo.sender_id === me ? 'Kendi mesajınıza yanıt' : `${conv.other_name} kişisine yanıt`}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {previewText(replyTo.kind, replyTo.content, false)}
                  </Text>
                </View>
                <IconButton icon={X} label="Yanıtı iptal et" size={30} onPress={() => setReplyTo(null)} />
              </View>
            ) : null}
            <View style={styles.inputRow}>
              <IconButton icon={Plus} label="Ekle" onPress={() => setSheet('attach')} />
              <View style={[styles.inputWrap, { backgroundColor: c.elevated }]}>
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={onChangeText}
                  placeholder="Mesaj yazın"
                  placeholderTextColor={c.subtle}
                  multiline
                  maxLength={2000}
                  style={[styles.input, { color: c.fg }]}
                  accessibilityLabel="Mesaj"
                />
                <Pressable hitSlop={8} onPress={() => setQuick((v) => !v)} accessibilityLabel="Hazır yanıtlar">
                  <Zap size={18} color={quick ? c.primary : c.subtle} />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Gönder"
                disabled={!text.trim() || sending}
                onPress={() => void send(text)}
                style={[styles.send, { backgroundColor: text.trim() ? c.primarySolid : c.elevated }]}
              >
                {sending ? (
                  <ActivityIndicator color={text.trim() ? c.onPrimary : c.primary} size="small" />
                ) : (
                  <Send size={18} color={text.trim() ? c.onPrimary : c.subtle} />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <PhotoViewer images={viewer ? [viewer] : []} start={viewer ? 0 : null} headers={authHeaders} onClose={() => setViewer(null)} />
      <PhotoReview photos={review} mode="chat" max={MAX_CHAT_PHOTOS} onCancel={() => setReview(null)} onConfirm={(photos, caption) => void sendReviewed(photos, caption)} />

      <Sheet visible={sheet === 'attach'} onClose={() => setSheet(null)} onDismissed={runAfterClose} title="Gönder">
        <RowGroup>
          <ListRow icon={ImagePlus} label="Galeriden fotoğraf" onPress={() => thenClose(() => void sendPhoto('library'))} />
          <ListRow icon={ImagePlus} label="Fotoğraf çek" onPress={() => thenClose(() => void sendPhoto('camera'))} />
          <ListRow icon={MapPin} label="Buluşma noktası paylaş" onPress={() => thenClose(() => setSheet('location'))} />
          {buying && conv.listing_status === 'ACTIVE' ? (
            <ListRow
              icon={HandCoins}
              label="Teklif ver"
              onPress={() =>
                thenClose(() => {
                  setCounterTo(null);
                  setSheet('offer');
                })
              }
            />
          ) : null}
        </RowGroup>
      </Sheet>

      <OfferComposer
        visible={sheet === 'offer'}
        onClose={() => setSheet(null)}
        listingPrice={conv.listing_price}
        currency={currency}
        counterTo={counterTo}
        onSend={async (amount) => {
          const msg = await chat.offer(id, amount, counterTo?.id);
          setMessages((list) =>
            sortMessages([
              ...list.map((m) =>
                m.kind === 'offer' && m.meta?.status === 'pending' && (m.id === counterTo?.id || m.sender_id === me)
                  ? { ...m, meta: { ...m.meta, status: m.id === counterTo?.id ? ('countered' as const) : ('withdrawn' as const) } }
                  : m,
              ),
              msg,
            ]),
          );
          if (jumpedRef.current) void backToLatest();
          setSheet(null);
          toast.success(counterTo ? 'Karşı teklif gönderildi' : 'Teklif gönderildi');
        }}
      />

      <LocationPicker visible={sheet === 'location'} onClose={() => setSheet(null)} onSend={async (label, lat, lng) => appendOwn(await chat.sendLocation(id, label, lat, lng))} />

      <Sheet visible={sheet === 'info'} onClose={() => setSheet(null)} title="Mesaj bilgisi">
        {selected ? (
          <>
            <View style={[styles.infoPreview, { backgroundColor: c.elevated }]}>
              <Text numberOfLines={4}>{previewText(selected.kind, selected.content, selected.deleted)}</Text>
            </View>
            <RowGroup>
              <ListRow icon={Check} label="Gönderildi" value={`${dayLabel(selected.created_at)} ${formatTime(selected.created_at)}`} />
              <ListRow
                icon={CheckCheck}
                label="Okundu"
                value={
                  !data.showReads
                    ? 'Okundu bilgisi kapalı'
                    : selected.read_at
                      ? `${dayLabel(selected.read_at)} ${formatTime(selected.read_at)}`
                      : 'Henüz okunmadı'
                }
              />
            </RowGroup>
          </>
        ) : null}
      </Sheet>

      <Sheet visible={sheet === 'actions'} onClose={() => setSheet(null)} onDismissed={runAfterClose} title="Mesaj">
        {selected ? (
          <RowGroup>
            <ListRow
              icon={Reply}
              label="Yanıtla"
              onPress={() =>
                thenClose(() => {
                  setReplyTo(selected);
                  inputRef.current?.focus();
                })
              }
            />
            {selected.sender_id === me ? (
              <ListRow icon={CheckCheck} label="Mesaj bilgisi" onPress={() => thenClose(() => setSheet('info'))} />
            ) : null}
            {selected.kind === 'text' && selected.content !== LISTING_PHOTO_MSG ? (
              <ListRow
                icon={Copy}
                label="Kopyala"
                onPress={() => {
                  void Clipboard.setStringAsync(selected.content);
                  setSheet(null);
                  toast.success('Kopyalandı');
                }}
              />
            ) : null}
            {selectedEditable ? (
              <ListRow
                icon={Pencil}
                label="Düzenle"
                onPress={() =>
                  thenClose(() => {
                    setReplyTo(null);
                    setEditingMsg(selected);
                    setText(selected.content);
                    inputRef.current?.focus();
                  })
                }
              />
            ) : null}
            {selectedDeletable ? (
              <ListRow
                icon={Trash2}
                label="Herkesten sil"
                danger
                onPress={() =>
                  thenClose(async () => {
                    const ok = await confirm({ title: 'Mesaj herkesten silinsin mi?', confirmText: 'Sil', destructive: true });
                    if (!ok) return;
                    try {
                      const updated = await chat.deleteMessage(selected.id);
                      setMessages((list) => list.map((m) => (m.id === updated.id ? updated : m)));
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  })
                }
              />
            ) : null}
            {selected.sender_id !== me ? (
              <ListRow icon={Flag} label="Mesajı bildir" danger onPress={() => thenClose(() => setSheet('report'))} />
            ) : null}
          </RowGroup>
        ) : null}
      </Sheet>

      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} onDismissed={runAfterClose} title={conv.other_name}>
        <RowGroup>
          {conv.listing_id ? (
            <ListRow
              icon={ExternalLink}
              label="İlanı gör"
              onPress={() => thenClose(() => router.push({ pathname: '/ilan/[id]', params: { id: conv.listing_id ?? '' } }))}
            />
          ) : null}
          <ListRow
            icon={conv.pinned ? PinOff : Pin}
            label={conv.pinned ? 'Sabitlemeyi kaldır' : 'Sohbeti sabitle'}
            onPress={() =>
              thenClose(async () => {
                try {
                  const next = !conv.pinned;
                  await chat.pin(id, next);
                  toast.success(next ? 'Sohbet sabitlendi' : 'Sabitleme kaldırıldı');
                  void queryClient.invalidateQueries({ queryKey: keys.inbox });
                  void queryClient.invalidateQueries({ queryKey: keys.thread(id) });
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              })
            }
          />
          <ListRow
            icon={conv.muted ? Bell : BellOff}
            label={conv.muted ? 'Bildirimleri aç' : 'Sohbeti sessize al'}
            onPress={() =>
              thenClose(async () => {
                try {
                  const next = !conv.muted;
                  await chat.mute(id, next);
                  toast.success(next ? 'Sohbet sessize alındı' : 'Bildirimler açıldı');
                  void queryClient.invalidateQueries({ queryKey: keys.inbox });
                  void queryClient.invalidateQueries({ queryKey: keys.thread(id) });
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              })
            }
          />
          <ListRow
            icon={MailOpen}
            label="Okunmadı olarak işaretle"
            onPress={() =>
              thenClose(async () => {
                try {
                  await chat.markUnread(id, true);
                  void queryClient.invalidateQueries({ queryKey: keys.inbox });
                  void queryClient.invalidateQueries({ queryKey: keys.counts });
                  goBackOrInbox();
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              })
            }
          />
          <ListRow
            icon={Archive}
            label="Arşivle"
            onPress={() =>
              thenClose(async () => {
                try {
                  await chat.archive(id, true);
                  toast.success('Sohbet arşivlendi');
                  void queryClient.invalidateQueries({ queryKey: keys.inbox });
                  void queryClient.invalidateQueries({ queryKey: keys.counts });
                  goBackOrInbox();
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              })
            }
          />
          <ListRow
            icon={Ban}
            label={data.blockedByMe ? 'Engeli kaldır' : 'Kullanıcıyı engelle'}
            danger={!data.blockedByMe}
            onPress={() =>
              thenClose(async () => {
                if (!data.blockedByMe) {
                  const ok = await confirm({
                    title: `${conv.other_name} engellensin mi?`,
                    message: 'Engellediğiniz kişi size mesaj gönderemez. Engeli Ayarlar’dan kaldırabilirsiniz.',
                    confirmText: 'Engelle',
                    destructive: true,
                  });
                  if (!ok) return;
                }
                try {
                  if (data.blockedByMe) await account.unblock(conv.other_id);
                  else await account.block(conv.other_id);
                  void thread.refetch();
                  void queryClient.invalidateQueries({ queryKey: keys.blocked });
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              })
            }
          />
          <ListRow
            icon={Flag}
            label="Sohbeti bildir"
            danger
            onPress={() =>
              thenClose(() => {
                setSelected(null);
                setSheet('report');
              })
            }
          />
          <ListRow
            icon={Trash2}
            label="Sohbeti sil"
            danger
            onPress={() =>
              thenClose(async () => {
                const ok = await confirm({ title: 'Sohbet silinsin mi?', message: 'Yalnızca sizin kutunuzdan silinir.', confirmText: 'Sil', destructive: true });
                if (!ok) return;
                try {
                  await chat.remove(id);
                  void queryClient.invalidateQueries({ queryKey: keys.inbox });
                  goBackOrInbox();
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              })
            }
          />
        </RowGroup>
      </Sheet>

      <ReportComposer
        visible={sheet === 'report'}
        onClose={() => setSheet(null)}
        onSend={async (reason, details) => {
          await chat.report(id, reason, details, selected?.id);
          toast.success('Bildiriminiz alındı. Teşekkürler.');
          setSheet(null);
        }}
      />

      <SearchSheet
        visible={sheet === 'search'}
        conversationId={id}
        onClose={() => setSheet(null)}
        onPick={(mid) => {
          setSheet(null);
          void jumpTo(mid);
        }}
      />
    </View>
  );
}

const MessageRow = memo(function MessageRow({
  message,
  grouped,
  mine,
  blocked,
  showReads,
  authHeaders,
  highlighted,
  otherName,
  listingImage,
  listingCurrency,
  onSwipeReply,
  onSwipeInfo,
  onLongPress,
  onInfo,
  onRetry,
  onOpenImage,
  onQuotePress,
  onOffer,
}: {
  message: ChatMessage;
  grouped: boolean;
  mine: boolean;
  blocked: boolean;
  showReads: boolean;
  authHeaders: Record<string, string>;
  highlighted: boolean;
  otherName: string;
  listingImage: string | null;
  listingCurrency: string;
  onSwipeReply: (m: ChatMessage) => void;
  onSwipeInfo: (m: ChatMessage) => void;
  onLongPress: (m: ChatMessage) => void;
  onInfo: (m: ChatMessage) => void;
  onRetry: (m: ChatMessage) => void;
  onOpenImage: (uri: string) => void;
  onQuotePress: (id: string) => void;
  onOffer: (m: ChatMessage, a: 'accept' | 'reject' | 'counter') => void;
}) {
  const handleReply = useCallback(() => onSwipeReply(message), [onSwipeReply, message]);
  const handleInfo = useCallback(() => onSwipeInfo(message), [onSwipeInfo, message]);
  const renderBubble = useCallback(
    (onBubbleLayout: Parameters<Parameters<typeof SwipeToReply>[0]['children']>[0]) => (
      <Bubble
        message={message}
        mine={mine}
        showReads={showReads}
        authHeaders={authHeaders}
        grouped={grouped}
        highlighted={highlighted}
        otherName={otherName}
        listingImage={listingImage}
        listingCurrency={listingCurrency}
        onLongPress={onLongPress}
        onInfo={onInfo}
        onRetry={onRetry}
        onOpenImage={onOpenImage}
        onQuotePress={onQuotePress}
        onOffer={onOffer}
        onLayout={onBubbleLayout}
      />
    ),
    [
      authHeaders,
      grouped,
      highlighted,
      listingCurrency,
      listingImage,
      message,
      mine,
      onInfo,
      onLongPress,
      onOffer,
      onOpenImage,
      onQuotePress,
      onRetry,
      otherName,
      showReads,
    ],
  );
  return (
    <SwipeToReply
      mine={mine}
      disabled={blocked || message.deleted || Boolean(message.pending)}
      onReply={handleReply}
      onInfo={mine && !message.deleted ? handleInfo : undefined}
    >
      {renderBubble}
    </SwipeToReply>
  );
});

function OfferComposer({
  visible,
  onClose,
  listingPrice,
  currency = 'TRY',
  counterTo,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  listingPrice: number | null;
  currency?: string;
  counterTo: ChatMessage | null;
  onSend: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const value = parseMasked(amount) ?? 0;
  const currencySymbol = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
  const step = listingPrice && listingPrice >= 1000 ? 100 : listingPrice && listingPrice >= 100 ? 10 : 1;
  const suggestions = (() => {
    if (counterTo || !listingPrice || listingPrice <= 0) return [];
    const seen = new Set<number>();
    const chips: { percent: number; amount: number }[] = [];
    for (const percent of [5, 10, 15]) {
      const rounded = Math.round(((listingPrice * (100 - percent)) / 100) / step) * step;
      if (rounded > 0 && rounded < listingPrice && !seen.has(rounded)) {
        seen.add(rounded);
        chips.push({ percent, amount: rounded });
      }
    }
    return chips;
  })();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onDismissed={() => setAmount('')}
      title={counterTo ? 'Karşı teklif' : 'Teklif ver'}
      subtitle={
        counterTo
          ? `Gelen teklif: ${formatPrice(counterTo.meta?.amount ?? 0, currency)}`
          : listingPrice
            ? `İlan fiyatı ${formatPrice(listingPrice, currency)}`
            : undefined
      }
      footer={
        <Button
          title="Gönder"
          block
          style={styles.flex}
          disabled={value < 1}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await onSend(value);
              setAmount('');
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <Input label="Tutar" keyboardType="number-pad" value={amount} onChangeText={(t) => setAmount(maskThousands(t))} suffix={currencySymbol} placeholder="0" />
      {suggestions.length ? (
        <View style={styles.chips}>
          {suggestions.map((s) => (
            <Chip key={s.amount} label={`%${s.percent} · ${formatPrice(s.amount, currency)}`} selected={value === s.amount} onPress={() => setAmount(maskThousands(String(s.amount)))} />
          ))}
        </View>
      ) : null}
      <Text variant="caption" tone="subtle">
        Yeni bir teklif, açıktaki önceki teklifi geri çeker. Teklif bağlayıcı değildir.
      </Text>
    </Sheet>
  );
}

function ReportComposer({ visible, onClose, onSend }: { visible: boolean; onClose: () => void; onSend: (reason: string, details?: string) => Promise<void> }) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onDismissed={() => {
        setReason(null);
        setDetails('');
      }}
      title="Bildir"
      footer={
        <Button
          title="Bildir"
          variant="danger"
          block
          style={styles.flex}
          disabled={!reason}
          loading={busy}
          onPress={async () => {
            if (!reason) return;
            setBusy(true);
            try {
              await onSend(reason, details.trim() || undefined);
              setReason(null);
              setDetails('');
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <View style={styles.chips}>
        {CHAT_REPORT_REASONS.map((r) => (
          <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <Input multiline placeholder="Ek açıklama (isteğe bağlı)" value={details} onChangeText={setDetails} maxLength={500} />
    </Sheet>
  );
}

function SearchSheet({ visible, onClose, conversationId, onPick }: { visible: boolean; onClose: () => void; conversationId: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const results = useQuery({ queryKey: ['chatSearch', conversationId, term], queryFn: () => chat.search(conversationId, term), enabled: term.length >= 2 });
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onDismissed={() => {
        setQ('');
        setTerm('');
      }}
      title="Sohbette ara"
      tall
    >
      <Input
        icon={Search}
        placeholder="En az 2 harf"
        value={q}
        onChangeText={setQ}
        returnKeyType="search"
        onSubmitEditing={() => setTerm(q.trim())}
      />
      {results.isFetching ? <ActivityIndicator /> : null}
      {results.data?.length === 0 ? (
        <Text tone="muted" center>
          Sonuç yok
        </Text>
      ) : null}
      {results.data?.length ? (
        <RowGroup>
          {results.data.map((r) => (
            <ListRow key={r.id} label={r.content} detail={dayLabel(r.created_at)} onPress={() => onPick(r.id)} />
          ))}
        </RowGroup>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  uploadNote: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.xs },
  flex: { flex: 1 },
  header: { borderBottomWidth: hairline, paddingBottom: space.sm, gap: space.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  listing: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.md, padding: space.sm, borderRadius: radius.md },
  listingThumb: { width: 40, height: 40, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  list: { paddingVertical: space.md },
  typingWrap: { paddingHorizontal: space.md, paddingTop: space.xs },
  typingPill: {
    alignSelf: 'flex-start',
    borderWidth: hairline,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: hairline,
  },
  older: { padding: space.md },
  emptyChat: { padding: space.xxl, transform: [{ scaleY: -1 }] },
  day: { alignItems: 'center', marginVertical: space.md },
  dayPill: { paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill },
  toBottom: {
    position: 'absolute',
    right: space.md,
    bottom: space.md,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toBottomBadge: { position: 'absolute', top: -6, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  toBottomText: { fontWeight: '700' },
  infoPreview: { padding: space.md, borderRadius: radius.md },
  latest: { position: 'absolute', alignSelf: 'center', bottom: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
  blocked: { padding: space.lg, gap: space.sm, alignItems: 'center', borderTopWidth: hairline },
  composer: { borderTopWidth: hairline, paddingTop: space.sm, gap: space.sm },
  offerHint: { paddingHorizontal: space.lg },
  quick: { paddingHorizontal: space.md, gap: space.sm },
  replyBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: space.md, paddingLeft: space.md, borderLeftWidth: 3, borderRadius: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs, paddingHorizontal: space.sm },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 22, paddingHorizontal: space.md, minHeight: 44 },
  input: { flex: 1, fontSize: font.md, maxHeight: 120, paddingVertical: 10 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});

