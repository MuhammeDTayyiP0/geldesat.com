import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import {
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  Copy,
  Flag,
  HandCoins,
  ImageIcon,
  ImagePlus,
  MapPin,
  MoreVertical,
  Plus,
  Reply,
  Search,
  Send,
  Trash2,
  X,
  Zap,
} from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { account, chat, uploads } from '@/api/endpoints';
import { keys, queryClient } from '@/api/queries';
import type { ChatMessage } from '@/api/types';
import { useSession } from '@/auth/session';
import { useFlag } from '@/lib/flags';
import { Bubble } from '@/features/chat/Bubble';
import { SwipeToReply } from '@/features/chat/SwipeToReply';
import { LocationPicker } from '@/features/chat/LocationPicker';
import { BUYER_QUICK_REPLIES, CHAT_REPORT_REASONS, DELETE_WINDOW_MS, LISTING_PHOTO_MSG, SELLER_QUICK_REPLIES, previewText } from '@/features/chat/shared';
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
  const chatV2 = useFlag('sohbet_v2');

  const thread = useQuery({ queryKey: keys.thread(id), queryFn: () => chat.thread(id), staleTime: 0, enabled: !!me, refetchOnReconnect: false });
  const templates = useQuery({ queryKey: keys.templates, queryFn: chat.templates, enabled: !!me, staleTime: 5 * 60_000 });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [jumped, setJumped] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  /** Shown above the box while photos upload ("Fotoğraflar gönderiliyor (2/3)…"). */
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  /** Photos picked for sending, shown full screen first (caption, turn, remove). */
  const [review, setReview] = useState<PickedPhoto[] | null>(null);
  const [quick, setQuick] = useState(false);
  const [typing, setTyping] = useState(false);
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
  const [away, setAway] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const awayRef = useRef(false);
  const inputRef = useRef<TextInputRef>(null);
  const [counterTo, setCounterTo] = useState<ChatMessage | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const listRef = useRef<FlatList<Row>>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const data = thread.data;
  const conv = data?.conversation;
  // sohbet_v2: the first unread message from when the chat opened gets a divider, and the list starts there.
  const firstUnreadId = data?.firstUnreadId ?? null;

  // Take the server's page whenever the thread (re)loads; live events add to it afterwards.
  const [syncedAt, setSyncedAt] = useState(0);
  if (data && thread.dataUpdatedAt !== syncedAt) {
    setSyncedAt(thread.dataUpdatedAt);
    setMessages(data.messages);
    setHasMore(data.hasMore);
    setJumped(false);
    setPresence({ online: data.conversation.other_online, lastSeen: data.conversation.other_last_seen });
  }

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

  // Where the last catch-up started (phone clock, with a margin for clock drift).
  const syncedFrom = useRef<string | null>(null);
  useEffect(() => {
    // A fresh page from the server: changes after it (an offer answered, a message deleted) come with the next catch-up.
    if (syncedAt) syncedFrom.current = new Date(syncedAt - 2 * 60_000).toISOString();
  }, [syncedAt]);
  const catchUp = useCallback(() => {
    const newest = [...messagesRef.current].reverse().find((m) => !m.pending);
    const after = syncedFrom.current ?? newest?.created_at;
    if (!after) return;
    const startedAt = new Date(Date.now() - 2 * 60_000).toISOString();
    void chat
      .poll(id, after)
      .then((r) => {
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
        setMessages((list) => mergeMessages(list, [{ ...msg, kind: msg.kind ?? 'text', meta: msg.meta ?? null, deleted: !!msg.deleted, reply: msg.reply ?? null }]));
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
      if (chatV2 && m.id === firstUnreadId) out.push({ type: 'day', key: 'unread', label: 'Okunmamış mesajlar' });
      if (!sameDay) out.push({ type: 'day', key: `day-${localDay(m.created_at)}`, label: dayLabel(m.created_at) });
    }
    return out;
  }, [messages, chatV2, firstUnreadId]);

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

  const appendOwn = (msg: ChatMessage) => setMessages((list) => sortMessages([...list, msg]));

  /**
   * Send a message. `fromInput`: the text came from the box (cleared now, put back on
   * failure only if nothing new was typed); a quick reply leaves the box alone.
   * With sohbet_v2 the message shows at once as "sending…" and a failed one can be
   * tapped to retry; the same client id makes a retry safe on the server.
   */
  const send = async (content: string, { fromInput = true, retry }: { fromInput?: boolean; retry?: ChatMessage } = {}) => {
    const value = content.trim();
    if (!value || (sending && !chatV2)) return;
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
    if (chatV2) setMessages((list) => sortMessages([...list.filter((m) => m.id !== local.id), local]));
    else setSending(true);
    try {
      appendOwn(await chat.send(id, value, reply?.id, clientId));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void queryClient.invalidateQueries({ queryKey: keys.inbox });
    } catch (e) {
      if (chatV2) {
        setMessages((list) => list.map((m) => (m.id === local.id ? { ...m, pending: 'failed' } : m)));
      } else if (fromInput) {
        setText((current) => (current.trim() ? current : value));
        setReplyTo((current) => current ?? reply);
      }
      toast.error(errorMessage(e));
    } finally {
      if (!chatV2) setSending(false);
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
      message: `${formatPrice(m.meta?.amount ?? 0)} teklif`,
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

  const jumpTo = async (messageId: string) => {
    if (messages.some((m) => m.id === messageId)) {
      const index = rows.findIndex((r) => r.type === 'message' && r.message.id === messageId);
      if (index >= 0) listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    } else {
      try {
        const r = await chat.around(id, messageId);
        setMessages(r.messages);
        setHasMore(r.hasMoreBefore);
        setJumped(r.hasMoreAfter);
      } catch (e) {
        toast.error(errorMessage(e));
        return;
      }
    }
    setHighlight(messageId);
    setTimeout(() => setHighlight(null), 2200);
  };

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

  // sohbet_v2: open at the first unread message, once per load.
  const scrolledToUnread = useRef<number | null>(null);
  useEffect(() => {
    if (!chatV2 || !firstUnreadId || scrolledToUnread.current === syncedAt) return;
    const index = rows.findIndex((row) => row.type === 'day' && row.key === 'unread');
    if (index < 3) return;
    scrolledToUnread.current = syncedAt;
    const t = setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.9, animated: false }), 250);
    return () => clearTimeout(t);
  }, [chatV2, firstUnreadId, rows, syncedAt]);

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
              {conv.listing_price ? formatPrice(conv.listing_price) : ''}
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
              setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true }), 120);
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
            ListFooterComponent={loadingOlder ? <ActivityIndicator color={c.primary} style={styles.older} /> : undefined}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text tone="muted" center>
                  Sohbete bir mesajla başlayın.
                </Text>
              </View>
            }
            renderItem={({ item }) =>
              item.type === 'day' ? (
                <View style={styles.day}>
                  <View style={[styles.dayPill, { backgroundColor: c.elevated }]}>
                    <Text variant="small" tone="muted">
                      {item.label}
                    </Text>
                  </View>
                </View>
              ) : (
                <SwipeToReply
                  mine={item.message.sender_id === me}
                  disabled={blocked || item.message.deleted}
                  onReply={() => {
                    setReplyTo(item.message);
                    inputRef.current?.focus();
                  }}
                  onInfo={
                    item.message.sender_id === me && !item.message.deleted
                      ? () => {
                          setSelected(item.message);
                          setSheet('info');
                        }
                      : undefined
                  }
                >
                  {(onBubbleLayout) => (
                    <Bubble
                      message={item.message}
                      mine={item.message.sender_id === me}
                      showReads={data.showReads}
                      authHeaders={authHeaders}
                      grouped={item.grouped}
                      highlighted={highlight === item.message.id}
                      otherName={conv.other_name}
                      listingImage={conv.listing_image}
                      onLongPress={openActions}
                      onInfo={openInfo}
                      onRetry={retrySend}
                      onOpenImage={setViewer}
                      onQuotePress={quotePress}
                      onOffer={offerAction}
                      onLayout={onBubbleLayout}
                    />
                  )}
                </SwipeToReply>
              )
            }
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
            <Pressable onPress={() => void thread.refetch()} style={[styles.latest, { backgroundColor: c.ink }]}>
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
                {conv.other_name} {formatPrice(pendingOfferFromOther.meta?.amount ?? 0)} teklif verdi. Yukarıdan yanıtlayabilirsiniz.
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
        counterTo={counterTo}
        onSend={async (amount) => {
          const msg = await chat.offer(id, amount, counterTo?.id);
          setMessages((list) =>
            sortMessages([
              ...list.map((m) => (m.kind === 'offer' && m.meta?.status === 'pending' ? { ...m, meta: { ...m.meta, status: m.id === counterTo?.id ? ('countered' as const) : ('withdrawn' as const) } } : m)),
              msg,
            ]),
          );
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
              onPress={() => {
                setReplyTo(selected);
                setSheet(null);
              }}
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
                  router.back();
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

function OfferComposer({
  visible,
  onClose,
  listingPrice,
  counterTo,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  listingPrice: number | null;
  counterTo: ChatMessage | null;
  onSend: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const value = parseMasked(amount) ?? 0;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={counterTo ? 'Karşı teklif' : 'Teklif ver'}
      subtitle={
        counterTo ? `Gelen teklif: ${formatPrice(counterTo.meta?.amount ?? 0)}` : listingPrice ? `İlan fiyatı ${formatPrice(listingPrice)}` : undefined
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
      <Input label="Tutar" keyboardType="number-pad" value={amount} onChangeText={(t) => setAmount(maskThousands(t))} suffix="₺" autoFocus placeholder="0" />
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
    <Sheet visible={visible} onClose={onClose} title="Sohbette ara" tall>
      <Input
        icon={Search}
        placeholder="En az 2 harf"
        value={q}
        onChangeText={setQ}
        returnKeyType="search"
        onSubmitEditing={() => setTerm(q.trim())}
        autoFocus
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

